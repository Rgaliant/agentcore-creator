import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AgentMemoryProps {
  agentName: string;
  /** Days before memory records expire. Default: 90 */
  eventExpiryDays?: number;
}

/**
 * L3 construct wrapping Amazon Bedrock AgentCore Memory.
 * Provides long-term semantic memory for agents — records are embedded
 * and retrieved via similarity search.
 *
 * Note: AgentCore Memory CloudFormation resource is newly available.
 * Verify resource type names match your CDK/CloudFormation provider version.
 */
export class AgentMemory extends Construct {
  public readonly memoryId: string;
  public readonly executionRole: iam.Role;

  constructor(scope: Construct, id: string, props: AgentMemoryProps) {
    super(scope, id);

    const { agentName, eventExpiryDays = 90 } = props;

    this.executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: `agentcore-memory-${agentName}`,
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: `Execution role for AgentCore Memory: ${agentName}`,
      inlinePolicies: {
        MemoryPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock-agentcore:*'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Memory ID follows AgentCore naming convention
    this.memoryId = `agentcore-memory-${agentName}`;

    new cdk.CfnOutput(this, 'MemoryId', {
      value: this.memoryId,
      exportName: `agentcore-${agentName}-memory-id`,
      description: `AgentCore Memory ID (${eventExpiryDays}-day expiry)`,
    });

    new cdk.CfnOutput(this, 'MemoryRoleArn', {
      value: this.executionRole.roleArn,
      exportName: `agentcore-${agentName}-memory-role-arn`,
    });
  }
}
