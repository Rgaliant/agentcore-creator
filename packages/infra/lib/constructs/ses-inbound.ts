import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sesActions from 'aws-cdk-lib/aws-ses-actions';
import { Construct } from 'constructs';

export interface SesInboundProps {
  /** Verified SES domain for receiving emails (e.g. mail.example.com) */
  domain: string;
  /** Optional: Vercel API route URL to POST SNS notifications to */
  webhookUrl?: string;
}

/**
 * Constructs SES inbound email processing pipeline:
 * Inbound email → SES receipt rule → S3 (raw .eml) + SNS → subscribers
 */
export class SesInbound extends Construct {
  public readonly emailBucket: s3.Bucket;
  public readonly emailTopic: sns.Topic;
  public readonly receiptRuleSet: ses.ReceiptRuleSet;

  constructor(scope: Construct, id: string, props: SesInboundProps) {
    super(scope, id);

    const { domain, webhookUrl } = props;

    // S3 bucket for raw email storage
    this.emailBucket = new s3.Bucket(this, 'EmailBucket', {
      bucketName: `agentcore-emails-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30),
          id: 'ExpireOldEmails',
        },
      ],
      serverAccessLogsPrefix: 'access-logs/',
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Grant SES permission to write to the bucket
    this.emailBucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.ServicePrincipal('ses.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [this.emailBucket.arnForObjects('*')],
        conditions: {
          StringEquals: { 'aws:Referer': cdk.Aws.ACCOUNT_ID },
        },
      })
    );

    // SNS topic for email notifications
    this.emailTopic = new sns.Topic(this, 'EmailTopic', {
      topicName: 'agentcore-email-ingest',
      displayName: 'AgentCore Inbound Email',
    });

    // If webhook URL is provided, subscribe it to the SNS topic
    if (webhookUrl) {
      this.emailTopic.addSubscription(
        new subscriptions.UrlSubscription(webhookUrl, {
          protocol: sns.SubscriptionProtocol.HTTPS,
        })
      );
    }

    // SES receipt rule set
    this.receiptRuleSet = new ses.ReceiptRuleSet(this, 'RuleSet', {
      receiptRuleSetName: 'agentcore-inbound',
    });

    // Receipt rule: save to S3 and notify SNS
    this.receiptRuleSet.addRule('IngestRule', {
      recipients: [`agent@${domain}`],
      actions: [
        new sesActions.S3({
          bucket: this.emailBucket,
          objectKeyPrefix: 'emails/',
          topic: this.emailTopic,
        }),
        new sesActions.Sns({ topic: this.emailTopic }),
      ],
      enabled: true,
      scanEnabled: true,
    });

    new cdk.CfnOutput(this, 'EmailBucketName', {
      value: this.emailBucket.bucketName,
      exportName: 'agentcore-email-bucket',
    });

    new cdk.CfnOutput(this, 'EmailTopicArn', {
      value: this.emailTopic.topicArn,
      exportName: 'agentcore-email-topic-arn',
    });
  }
}
