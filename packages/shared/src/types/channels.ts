// ── Discord ──────────────────────────────────────────────────────────────────

/** Raw payload from Discord Interactions webhook */
export interface DiscordInteractionPayload {
  /** 1=PING, 2=APPLICATION_COMMAND, 3=MESSAGE_COMPONENT, 4=AUTOCOMPLETE */
  type: number;
  token: string;
  application_id: string;
  guild_id?: string;
  channel_id: string;
  member?: {
    user: { id: string; username: string; discriminator?: string };
  };
  user?: { id: string; username: string };
  data?: {
    id?: string;
    name: string;
    options?: Array<{ name: string; value: string; type: number }>;
    custom_id?: string;
    component_type?: number;
  };
  message?: { id: string; content: string };
}

/** Normalized Discord message for workflow consumption */
export interface DiscordMessage {
  channelId: string;
  userId: string;
  username: string;
  content: string;
  /** Discord interaction token — used to send follow-up responses */
  token: string;
  applicationId: string;
  guildId?: string;
}

// ── Email ─────────────────────────────────────────────────────────────────────

/** Parsed inbound email payload (from SES → SNS → API route) */
export interface EmailPayload {
  messageId: string;
  from: string;
  to: string;
  /** Convention: "agent:<agentName> <user query>" or plain subject */
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  /** In-Reply-To header — used to resume existing conversation thread */
  inReplyTo?: string;
  /** S3 key where the raw .eml is stored */
  s3Key: string;
  receivedAt: string;
}

/** SNS notification wrapper from SES inbound rule */
export interface SnsNotification {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';
  MessageId: string;
  TopicArn: string;
  Message: string; // JSON-stringified EmailPayload or SES notification
  SubscribeURL?: string; // Only present on SubscriptionConfirmation
  Timestamp: string;
}
