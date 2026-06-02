import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { SesInbound } from '../constructs/ses-inbound.js';

export interface MessagingStackProps extends cdk.StackProps {
  /** Verified SES domain for receiving inbound emails */
  sesDomain: string;
  /** Vercel API route URL for SNS → webhook forwarding */
  vercelEmailWebhookUrl?: string;
}

/**
 * Provisions all async messaging infrastructure:
 * - SQS queues for Discord and email message buffering
 * - Custom EventBridge bus for agent lifecycle events
 * - SES inbound email pipeline (receipt rules → S3 → SNS)
 *
 * Deploy once per environment: cdk deploy AgentMessaging
 */
export class MessagingStack extends cdk.Stack {
  public readonly discordQueueUrl: string;
  public readonly emailIngestQueueUrl: string;
  public readonly agentEventBusName: string;
  public readonly emailTopicArn: string;

  constructor(scope: Construct, id: string, props: MessagingStackProps) {
    super(scope, id, props);

    const { sesDomain, vercelEmailWebhookUrl } = props;

    console.log('[MessagingStack] Synthesizing messaging infrastructure');
    console.log(`[MessagingStack] SES domain: ${sesDomain}`);

    // ── Discord Queue ────────────────────────────────────────────────────────
    const discordDlq = new sqs.Queue(this, 'DiscordDLQ', {
      queueName: 'agentcore-discord-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    const discordQueue = new sqs.Queue(this, 'DiscordQueue', {
      queueName: 'agentcore-discord',
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(7),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: discordDlq,
        maxReceiveCount: 3,
      },
    });

    this.discordQueueUrl = discordQueue.queueUrl;

    // ── Email Ingest Queue ───────────────────────────────────────────────────
    const emailDlq = new sqs.Queue(this, 'EmailDLQ', {
      queueName: 'agentcore-email-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    const emailIngestQueue = new sqs.Queue(this, 'EmailIngestQueue', {
      queueName: 'agentcore-email-ingest',
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(7),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: emailDlq,
        maxReceiveCount: 3,
      },
    });

    this.emailIngestQueueUrl = emailIngestQueue.queueUrl;

    // ── Agent EventBridge Bus ────────────────────────────────────────────────
    const agentEventBus = new events.EventBus(this, 'AgentEventBus', {
      eventBusName: 'agentcore-events',
    });

    this.agentEventBusName = agentEventBus.eventBusName;

    // Route completed agent run events to an SNS topic for external notifications
    const runCompletedTopic = new sns.Topic(this, 'RunCompletedTopic', {
      topicName: 'agentcore-run-completed',
    });

    new events.Rule(this, 'RunCompletedRule', {
      eventBus: agentEventBus,
      ruleName: 'agentcore-run-completed',
      description: 'Routes agent run completion events to SNS',
      eventPattern: {
        source: ['agentcore'],
        detailType: ['agentcore.run.completed'],
      },
      targets: [new targets.SnsTopic(runCompletedTopic)],
    });

    // ── SES Inbound Email Pipeline ───────────────────────────────────────────
    const sesInbound = new SesInbound(this, 'SesInbound', {
      domain: sesDomain,
      webhookUrl: vercelEmailWebhookUrl,
    });

    this.emailTopicArn = sesInbound.emailTopic.topicArn;

    // ── CloudFormation Outputs ───────────────────────────────────────────────
    new cdk.CfnOutput(this, 'DiscordQueueUrl', {
      value: this.discordQueueUrl,
      exportName: 'agentcore-discord-queue-url',
    });
    new cdk.CfnOutput(this, 'EmailIngestQueueUrl', {
      value: this.emailIngestQueueUrl,
      exportName: 'agentcore-email-ingest-queue-url',
    });
    new cdk.CfnOutput(this, 'AgentEventBusName', {
      value: this.agentEventBusName,
      exportName: 'agentcore-event-bus-name',
    });
    new cdk.CfnOutput(this, 'EmailTopicArn', {
      value: this.emailTopicArn,
      exportName: 'agentcore-email-topic-arn',
    });

    cdk.Tags.of(this).add('agentcore:component', 'messaging');
    cdk.Tags.of(this).add('agentcore:managed', 'true');
  }
}
