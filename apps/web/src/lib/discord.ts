import { hexToBytes } from '@noble/ed25519';
import * as ed from '@noble/ed25519';

/**
 * Verifies a Discord Ed25519 interaction signature.
 * Must be called before processing any Discord interaction.
 */
export async function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  try {
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    if (!publicKey) throw new Error('DISCORD_PUBLIC_KEY not configured');

    const message = new TextEncoder().encode(timestamp + body);
    const sigBytes = hexToBytes(signature);
    const pubKeyBytes = hexToBytes(publicKey);

    return await ed.verify(sigBytes, message, pubKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Sends a follow-up message to a Discord interaction via the webhook token.
 * Used after returning a deferred response (type 5) from the initial webhook.
 */
export async function sendDiscordFollowup(
  applicationId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;

  // Discord messages are limited to 2000 characters
  const truncated = content.length > 2000
    ? content.slice(0, 1997) + '...'
    : content;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: truncated }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord follow-up failed: ${response.status} ${error}`);
  }
}

/**
 * Edits the original deferred response (when you need to update it).
 */
export async function editDiscordResponse(
  applicationId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.slice(0, 2000) }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord edit failed: ${response.status} ${error}`);
  }
}
