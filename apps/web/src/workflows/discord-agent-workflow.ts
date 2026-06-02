import { createHook, getWritable } from 'workflow';
import { DurableAgent } from '@workflow/ai/agent';
import { stepCountIs } from 'ai';
import type { UIMessageChunk } from 'ai';
import type { DiscordMessage } from '@agentcore/shared';
import { sendDiscordFollowup } from '@/lib/discord';

type ConversationMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Durable multi-turn Discord conversation workflow.
 *
 * Flow:
 * 1. Process initial message and send Discord follow-up
 * 2. Wait on createHook for subsequent messages in the same channel/user
 * 3. Repeat until done:true or hook times out
 *
 * Hook token: `discord-{channelId}-{userId}` (deterministic — enables resume)
 */
export async function discordAgentWorkflow(discordMessage: DiscordMessage): Promise<void> {
  'use workflow';

  console.log('[workflow] discordAgentWorkflow start', {
    channelId: discordMessage.channelId,
    userId: discordMessage.userId,
    username: discordMessage.username,
  });

  const hook = createHook<{ text: string; done?: boolean }>({
    token: `discord-${discordMessage.channelId}-${discordMessage.userId}`,
  });

  const history: ConversationMessage[] = [];

  // Process initial message, then loop on hook events
  for await (const event of mergeInitialWithHook(discordMessage.content, hook)) {
    console.log('[workflow] discordAgentWorkflow processing turn', {
      text: event.text.slice(0, 80),
    });

    await processAndRespond({
      userMessage: event.text,
      discordToken: discordMessage.token,
      applicationId: discordMessage.applicationId,
      history,
    });

    if (event.done) {
      console.log('[workflow] discordAgentWorkflow session closed by user');
      break;
    }
  }

  console.log('[workflow] discordAgentWorkflow complete');
}

// ── Step functions ────────────────────────────────────────────────────────────

async function processAndRespond(params: {
  userMessage: string;
  discordToken: string;
  applicationId: string;
  history: ConversationMessage[];
}): Promise<void> {
  'use step';

  const { userMessage, discordToken, applicationId, history } = params;
  console.log('[step] processAndRespond start', { chars: userMessage.length });

  history.push({ role: 'user', content: userMessage });

  // Model routes through Vercel AI Gateway. Run `vercel env pull` to
  // provision VERCEL_OIDC_TOKEN (preferred auth, auto-refreshes on Vercel).
  const agent = new DurableAgent({
    model: 'anthropic/claude-sonnet-4.6',
    system: `You are AgentCore Assistant — a helpful AI agent managing AWS infrastructure and AI agents.
You help users understand their agents, debug issues, and configure deployments.
Keep responses concise (Discord 2000 char limit). Use markdown formatting.`,
  });

  const result = await agent.stream({
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    writable: getWritable<UIMessageChunk>({ namespace: 'discord:output' }),
    stopWhen: stepCountIs(5),
  });

  const responseText = extractText(result.messages);
  history.push({ role: 'assistant', content: responseText });

  // Send response back to Discord via interaction webhook token
  await sendDiscordFollowup(applicationId, discordToken, responseText);

  console.log('[step] processAndRespond done', { responseChars: responseText.length });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function* mergeInitialWithHook(
  initial: string,
  hook: AsyncIterable<{ text: string; done?: boolean }>
): AsyncIterable<{ text: string; done?: boolean }> {
  yield { text: initial };
  for await (const event of hook) {
    yield event;
  }
}

function extractText(messages: Array<{ role: string; content: unknown }>): string {
  return messages
    .filter((m) => m.role === 'assistant')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('\n');
}
