import { resumeHook } from 'workflow/api';
import { WorkflowResumeSchema } from '@agentcore/shared';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
): Promise<Response> {
  const { runId } = await params;
  const startMs = Date.now();

  try {
    const body = WorkflowResumeSchema.parse(await req.json());
    console.log('[workflows/resume] resuming hook', { runId, token: body.token });

    await resumeHook(body.token, body.payload);

    console.log('[workflows/resume] resumed', { runId, ms: Date.now() - startMs });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[workflows/resume] error', {
      runId,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startMs,
    });
    return Response.json({ error: 'Failed to resume workflow' }, { status: 400 });
  }
}
