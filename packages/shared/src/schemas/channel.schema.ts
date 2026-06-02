import { z } from 'zod';

export const DiscordMessageSchema = z.object({
  channelId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  content: z.string().min(1).max(2000),
  token: z.string().min(1),
  applicationId: z.string().min(1),
  guildId: z.string().optional(),
});

export const EmailPayloadSchema = z.object({
  messageId: z.string().min(1),
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string(),
  bodyText: z.string(),
  bodyHtml: z.string().optional(),
  inReplyTo: z.string().optional(),
  s3Key: z.string().min(1),
  receivedAt: z.string().datetime(),
});

export const SnsNotificationSchema = z.object({
  Type: z.enum(['Notification', 'SubscriptionConfirmation', 'UnsubscribeConfirmation']),
  MessageId: z.string(),
  TopicArn: z.string(),
  Message: z.string(),
  SubscribeURL: z.string().url().optional(),
  Timestamp: z.string(),
});

export const WorkflowResumeSchema = z.object({
  token: z.string().min(1),
  payload: z.record(z.unknown()),
});
