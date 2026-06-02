import { createHook, getWritable } from 'workflow';
import { DurableAgent } from '@workflow/ai/agent';
import { stepCountIs } from 'ai';
import type { UIMessageChunk } from 'ai';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { EmailPayload } from '@agentcore/shared';

const ses = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

/**
 * Durable email-based agent workflow.
 * Parses inbound email, runs DurableAgent, replies via SES.
 * Supports multi-turn via In-Reply-To header as hook token.
 *
 * Hook token: `email-{messageId}` for new threads,
 *             `email-{inReplyTo}` for thread continuations.
 */
export async function emailAgentWorkflow(emailPayload: EmailPayload): Promise<void> {
  'use workflow';

  const threadId = emailPayload.inReplyTo ?? emailPayload.messageId;
  console.log('[workflow] emailAgentWorkflow start', {
    from: emailPayload.from,
    subject: emailPayload.subject,
    threadId,
  });

  await processEmailTurn({
    emailPayload,
    threadId,
  });

  // Set up hook for potential follow-up replies on the same thread
  const hook = createHook<{ emailPayload: EmailPayload; done?: boolean }>({
    token: `email-${threadId}`,
  });

  for await (const event of hook) {
    if (event.done) break;
    await processEmailTurn({ emailPayload: event.emailPayload, threadId });
  }

  console.log('[workflow] emailAgentWorkflow complete');
}

// ── Step functions ────────────────────────────────────────────────────────────

async function processEmailTurn(params: {
  emailPayload: EmailPayload;
  threadId: string;
}): Promise<void> {
  'use step';

  const { emailPayload } = params;
  console.log('[step] processEmailTurn start', {
    from: emailPayload.from,
    subject: emailPayload.subject,
  });

  // Parse agent name from subject: "agent:<name> <query>" or just use default
  const subjectMatch = emailPayload.subject.match(/^agent:(\w[\w-]*)\s+(.*)/i);
  const agentName = subjectMatch?.[1] ?? 'assistant';
  const userQuery = subjectMatch?.[2] ?? emailPayload.bodyText;

  // Model routes through Vercel AI Gateway. Run `vercel env pull` to
  // provision VERCEL_OIDC_TOKEN (preferred auth, auto-refreshes on Vercel).
  const agent = new DurableAgent({
    model: 'anthropic/claude-sonnet-4.6',
    system: `You are ${agentName} — an AI agent accessible via email.
Answer the user's question concisely. Format your response as plain text suitable for email.
Do not use markdown or code blocks unless specifically asked.`,
  });

  const result = await agent.stream({
    messages: [{ role: 'user', content: userQuery }],
    writable: getWritable<UIMessageChunk>({ namespace: 'email:output' }),
    stopWhen: stepCountIs(3),
  });

  const responseText = result.messages
    .filter((m) => m.role === 'assistant')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('\n');

  console.log('[step] processEmailTurn agent responded', { chars: responseText.length });

  // Send reply via SES
  await ses.send(
    new SendEmailCommand({
      Source: process.env.SES_FROM_ADDRESS ?? `agent@${process.env.SES_DOMAIN}`,
      Destination: { ToAddresses: [emailPayload.from] },
      Message: {
        Subject: { Data: `Re: ${emailPayload.subject}` },
        Body: { Text: { Data: responseText } },
      },
      ReplyToAddresses: [process.env.SES_FROM_ADDRESS ?? ''],
    })
  );

  console.log('[step] processEmailTurn email sent', { to: emailPayload.from });
}
