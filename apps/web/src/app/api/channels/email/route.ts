import { fetch } from 'workflow';
import { start, resumeHook } from 'workflow/api';
import { parseSNSMessage, parseRawEmail } from '@/lib/email';
import { emailAgentWorkflow } from '@/workflows/email-agent-workflow';

export const runtime = 'nodejs';

/**
 * SNS notification endpoint for inbound SES emails.
 * SES receipt rule → SNS topic → this route → emailAgentWorkflow
 */
export async function POST(req: Request): Promise<Response> {
  const startMs = Date.now();
  const requestId = crypto.randomUUID();

  try {
    console.log('[email] received SNS notification', { requestId, ts: new Date().toISOString() });

    const snsMessage = await parseSNSMessage(req);

    // Handle SNS subscription confirmation (one-time setup)
    if (snsMessage.Type === 'SubscriptionConfirmation') {
      console.log('[email] confirming SNS subscription', { requestId });
      await confirmSnsSubscription(snsMessage.SubscribeURL!);
      return new Response('ok');
    }

    if (snsMessage.Type !== 'Notification') {
      return new Response('ignored');
    }

    const emailPayload = await parseRawEmail(snsMessage.Message);
    const threadId = emailPayload.inReplyTo ?? emailPayload.messageId;

    console.log('[email] parsed email', {
      requestId,
      from: emailPayload.from,
      subject: emailPayload.subject,
      threadId,
    });

    // If this is a reply to an existing thread, resume the hook
    if (emailPayload.inReplyTo) {
      try {
        await resumeHook(`email-${emailPayload.inReplyTo}`, { emailPayload });
        console.log('[email] resumed existing thread', { requestId, threadId, ms: Date.now() - startMs });
        return new Response('ok');
      } catch {
        console.log('[email] no active thread, starting new workflow', { requestId, threadId });
      }
    }

    await start(emailAgentWorkflow, [emailPayload]);
    console.log('[email] started new workflow', { requestId, threadId, ms: Date.now() - startMs });

    return new Response('ok');
  } catch (error) {
    console.error('[email] handler error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startMs,
    });
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ── Step functions ────────────────────────────────────────────────────────────

/** Confirms an SNS subscription via GET to the provided URL. */
async function confirmSnsSubscription(url: string): Promise<void> {
  'use step';
  console.log('[step] confirmSnsSubscription start', { url: url.slice(0, 80) });
  const res = await fetch(url);
  console.log('[step] confirmSnsSubscription done', { status: res.status });
  if (!res.ok) throw new Error(`SNS confirmation failed: ${res.status}`);
}
