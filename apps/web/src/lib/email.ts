import { simpleParser } from 'mailparser';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { EmailPayload, SnsNotification } from '@agentcore/shared';
import { SnsNotificationSchema } from '@agentcore/shared';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });

/**
 * Parses an SNS notification from a raw HTTP request.
 * Handles both Notification and SubscriptionConfirmation types.
 */
export async function parseSNSMessage(req: Request): Promise<SnsNotification> {
  const body = await req.text();
  return SnsNotificationSchema.parse(JSON.parse(body));
}

/**
 * Parses a raw email from SES → S3 into a structured EmailPayload.
 * The SNS message contains the S3 key where the raw .eml is stored.
 */
export async function parseRawEmail(snsMessage: string): Promise<EmailPayload> {
  let sesNotification: { mail?: { messageId?: string }; receipt?: unknown };

  try {
    sesNotification = JSON.parse(snsMessage);
  } catch {
    throw new Error('Invalid SES notification JSON');
  }

  const messageId = (sesNotification as { mail?: { messageId?: string } }).mail?.messageId ?? '';
  const s3Key = `emails/${messageId}`;
  const bucket = process.env.SES_S3_BUCKET;

  if (!bucket) throw new Error('SES_S3_BUCKET not configured');

  // Fetch raw email from S3
  const s3Response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: s3Key })
  );

  const rawEmail = await s3Response.Body?.transformToString() ?? '';

  // Parse the raw email
  const parsed = await simpleParser(rawEmail);

  const from = Array.isArray(parsed.from?.value)
    ? (parsed.from?.value[0]?.address ?? '')
    : '';

  const to = Array.isArray(parsed.to)
    ? (parsed.to[0]?.value?.[0]?.address ?? '')
    : (parsed.to?.value?.[0]?.address ?? '');

  return {
    messageId,
    from,
    to,
    subject: parsed.subject ?? '(no subject)',
    bodyText: parsed.text ?? '',
    bodyHtml: parsed.html || undefined,
    inReplyTo: parsed.inReplyTo ?? undefined,
    s3Key,
    receivedAt: new Date().toISOString(),
  };
}
