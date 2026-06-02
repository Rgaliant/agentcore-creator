import { start, resumeHook } from 'workflow/api';
import { verifyDiscordSignature } from '@/lib/discord';
import { discordAgentWorkflow } from '@/workflows/discord-agent-workflow';
import type { DiscordInteractionPayload, DiscordMessage } from '@agentcore/shared';

export const runtime = 'nodejs';

/**
 * Discord Interactions webhook endpoint.
 * CRITICAL: Must respond within 3 seconds or Discord will time out the interaction.
 *
 * Flow:
 * 1. Verify Ed25519 signature
 * 2. Respond immediately to PING (type 1)
 * 3. Try to resume an active multi-turn hook — if found, return deferred ACK
 * 4. Otherwise start a new workflow — return deferred ACK
 * 5. Workflow posts follow-up via Discord webhook token asynchronously
 */
export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const signature = req.headers.get('x-signature-ed25519') ?? '';
  const timestamp = req.headers.get('x-signature-timestamp') ?? '';

  console.log('[discord] received interaction');

  // Step 1: Verify Ed25519 signature (required by Discord)
  const valid = await verifyDiscordSignature(body, signature, timestamp);
  if (!valid) {
    console.error('[discord] signature verification failed');
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = JSON.parse(body) as DiscordInteractionPayload;

  // Step 2: Respond to Discord verification PING
  if (payload.type === 1) {
    console.log('[discord] responding to PING');
    return Response.json({ type: 1 });
  }

  // Only handle APPLICATION_COMMAND (type 2) interactions
  if (payload.type !== 2) {
    return Response.json({ type: 1 });
  }

  const userId = payload.member?.user.id ?? payload.user?.id ?? 'unknown';
  const channelId = payload.channel_id;
  const content = payload.data?.options?.[0]?.value ?? '';
  const hookToken = `discord-${channelId}-${userId}`;

  console.log('[discord] processing command', { userId, channelId, content: content.slice(0, 50) });

  // Step 3: Try to resume an existing multi-turn session
  try {
    await resumeHook(hookToken, { text: content });
    console.log('[discord] resumed existing session');
    // Return deferred response — workflow will follow up
    return Response.json({ type: 5 });
  } catch {
    // No active session — start a new workflow below
  }

  // Step 4: Start a new workflow
  const discordMessage: DiscordMessage = {
    channelId,
    userId,
    username: payload.member?.user.username ?? payload.user?.username ?? 'user',
    content,
    token: payload.token,
    applicationId: payload.application_id,
    guildId: payload.guild_id,
  };

  await start(discordAgentWorkflow, [discordMessage]);
  console.log('[discord] started new workflow');

  // Step 5: Return deferred response (bot will follow up asynchronously)
  return Response.json({ type: 5 });
}
