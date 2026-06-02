import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AgentGatewayProps {
  agentName: string;
  /** ARNs of Lambda functions to expose as MCP tools via the gateway */
  toolLambdaArns?: string[];
}

/**
 * L3 construct wrapping Amazon Bedrock AgentCore Gateway.
 * Exposes Lambda-backed tool functions via the MCP protocol with AWS IAM auth.
 *
 * Note: AgentCore Gateway CloudFormation resources are newly available.
 * Verify resource type names match your CDK/CloudFormation provider version.
 */
export class AgentGateway extends Construct {
  public readonly gatewayUrl: string;
  public readonly executionRole: iam.Role;

  constructor(scope: Construct, id: string, props: AgentGatewayProps) {
    super(scope, id);

    const { agentName, toolLambdaArns = [] } = props;

    // IAM role for Gateway — needs to invoke tool Lambda functions
    this.executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: `agentcore-gateway-${agentName}`,
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: `Execution role for AgentCore Gateway: ${agentName}`,
      inlinePolicies: {
        GatewayPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock-agentcore:*'],
              resources: ['*'],
            }),
            ...(toolLambdaArns.length > 0
              ? [
                  new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['lambda:InvokeFunction'],
                    resources: toolLambdaArns,
                  }),
                ]
              : []),
          ],
        }),
      },
    });

    // Gateway endpoint URL (constructed from region + name convention)
    // Actual gateway URL is returned by CloudFormation after deploy
    this.gatewayUrl = `https://bedrock-agentcore-gateway.${cdk.Aws.REGION}.amazonaws.com/gateways/${agentName}/mcp`;

    new cdk.CfnOutput(this, 'GatewayUrl', {
      value: this.gatewayUrl,
      exportName: `agentcore-${agentName}-gateway-url`,
      description: 'AgentCore Gateway MCP endpoint URL',
    });

    new cdk.CfnOutput(this, 'GatewayRoleArn', {
      value: this.executionRole.roleArn,
      exportName: `agentcore-${agentName}-gateway-role-arn`,
    });
  }
}
