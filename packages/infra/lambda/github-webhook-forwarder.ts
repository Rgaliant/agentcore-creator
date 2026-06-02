import { createHmac, timingSafeEqual } from 'crypto';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const ssm = new SSMClient({ region: process.env.AWS_REGION });

let cachedSecret: string | null = null;

async function getWebhookSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  console.log('[github-webhook] Fetching webhook secret from SSM');
  const result = await ssm.send(
    new GetParameterCommand({
      Name: process.env.WEBHOOK_SECRET_PARAM,
      WithDecryption: true,
    })
  );
  cachedSecret = result.Parameter?.Value ?? '';
  return cachedSecret;
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = event.body ?? '';
  const signature = event.headers['x-hub-signature-256'] ?? '';
  const githubEvent = event.headers['x-github-event'] ?? '';
  const deliveryId = event.headers['x-github-delivery'] ?? 'unknown';

  console.log(`[github-webhook] Received event: ${githubEvent}, delivery: ${deliveryId}`);

  if (!signature) {
    console.error('[github-webhook] Missing x-hub-signature-256 header');
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing signature' }) };
  }

  const secret = await getWebhookSecret();
  if (!verifySignature(body, signature, secret)) {
    console.error('[github-webhook] Signature verification failed');
    return { statusCode: 403, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  console.log(`[github-webhook] Signature verified, forwarding to Vercel`);

  const vercelUrl = process.env.VERCEL_WEBHOOK_URL;
  if (!vercelUrl) {
    console.error('[github-webhook] VERCEL_WEBHOOK_URL not configured');
    return { statusCode: 500, body: JSON.stringify({ error: 'Webhook URL not configured' }) };
  }

  try {
    const response = await fetch(vercelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature,
        'x-github-event': githubEvent,
        'x-github-delivery': deliveryId,
      },
      body,
    });

    console.log(`[github-webhook] Forwarded to Vercel, status: ${response.status}`);

    return {
      statusCode: response.ok ? 200 : 502,
      body: JSON.stringify({ forwarded: true, vercelStatus: response.status }),
    };
  } catch (error) {
    console.error('[github-webhook] Failed to forward to Vercel:', error);
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to forward webhook' }) };
  }
}
