import { start } from 'workflow/api';
import { codeReviewWorkflow } from '@agentcore/agents';
import { verifyGitHubSignature } from '@/lib/github';
import type { PullRequestEvent } from '@agentcore/shared';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const startMs = Date.now();
  const deliveryId = req.headers.get('x-github-delivery') ?? 'unknown';
  const event = req.headers.get('x-github-event') ?? '';

  try {
    console.log('[github] received webhook', { event, deliveryId });

    const body = await req.text();
    const sig = req.headers.get('x-hub-signature-256') ?? '';

    if (!verifyGitHubSignature(body, sig)) {
      console.error('[github] signature verification failed', { deliveryId });
      return new Response('Forbidden', { status: 403 });
    }

    if (event !== 'pull_request') {
      console.log('[github] ignoring non-PR event', { event, deliveryId });
      return new Response('ignored');
    }

    const payload = JSON.parse(body) as PullRequestEvent;

    if (!['opened', 'synchronize', 'reopened'].includes(payload.action)) {
      console.log('[github] ignoring PR action', { action: payload.action, deliveryId });
      return new Response('ignored');
    }

    const run = await start(codeReviewWorkflow, [payload]);

    console.log('[github] started code review workflow', {
      deliveryId,
      repo: payload.repository.full_name,
      pr: payload.pull_request.number,
      runId: run.runId,
      ms: Date.now() - startMs,
    });

    return Response.json({ runId: run.runId });
  } catch (error) {
    console.error('[github] handler error', {
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startMs,
    });
    return new Response('Internal Server Error', { status: 500 });
  }
}
