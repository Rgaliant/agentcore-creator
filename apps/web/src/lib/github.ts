import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies a GitHub webhook HMAC-SHA256 signature.
 * Timing-safe comparison to prevent timing attacks.
 */
export function verifyGitHubSignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[github] GITHUB_WEBHOOK_SECRET not configured');
    return false;
  }

  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
