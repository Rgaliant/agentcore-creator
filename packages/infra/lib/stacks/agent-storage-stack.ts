import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Provisions the three DynamoDB tables used by agentcore-creator.
 * All tables use PAY_PER_REQUEST billing, encryption at rest, and PITR.
 * Deploy once per environment: cdk deploy AgentStorage
 */
export class AgentStorageStack extends cdk.Stack {
  public readonly agentConfigsTableName: string;
  public readonly agentRunsTableName: string;
  public readonly conversationThreadsTableName: string;

  public readonly agentConfigsTableArn: string;
  public readonly agentRunsTableArn: string;
  public readonly conversationThreadsTableArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    console.log('[AgentStorageStack] Synthesizing DynamoDB tables');

    // ── Agent Configs Table ──────────────────────────────────────────────────
    const agentConfigsTable = new dynamodb.Table(this, 'AgentConfigsTable', {
      tableName: 'agentcore-agent-configs',
      partitionKey: { name: 'agentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    agentConfigsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.agentConfigsTableName = agentConfigsTable.tableName;
    this.agentConfigsTableArn = agentConfigsTable.tableArn;

    // ── Agent Runs Table ─────────────────────────────────────────────────────
    const agentRunsTable = new dynamodb.Table(this, 'AgentRunsTable', {
      tableName: 'agentcore-agent-runs',
      partitionKey: { name: 'agentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'runId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'expiresAt', // auto-expire old run records after 90 days
    });

    agentRunsTable.addGlobalSecondaryIndex({
      indexName: 'StatusStartedAtIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.agentRunsTableName = agentRunsTable.tableName;
    this.agentRunsTableArn = agentRunsTable.tableArn;

    // ── Conversation Threads Table ───────────────────────────────────────────
    // threadId convention: "discord-{channelId}-{userId}" | "email-{messageId}" | "web-{sessionId}"
    const conversationThreadsTable = new dynamodb.Table(this, 'ConversationThreadsTable', {
      tableName: 'agentcore-conversation-threads',
      partitionKey: { name: 'threadId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'expiresAt', // 30-day conversation expiry
    });

    this.conversationThreadsTableName = conversationThreadsTable.tableName;
    this.conversationThreadsTableArn = conversationThreadsTable.tableArn;

    // ── CloudFormation Outputs ───────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AgentConfigsTableName', {
      value: this.agentConfigsTableName,
      exportName: 'agentcore-agent-configs-table',
    });
    new cdk.CfnOutput(this, 'AgentRunsTableName', {
      value: this.agentRunsTableName,
      exportName: 'agentcore-agent-runs-table',
    });
    new cdk.CfnOutput(this, 'ConversationThreadsTableName', {
      value: this.conversationThreadsTableName,
      exportName: 'agentcore-conversation-threads-table',
    });

    cdk.Tags.of(this).add('agentcore:component', 'storage');
    cdk.Tags.of(this).add('agentcore:managed', 'true');
  }
}
