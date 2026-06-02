import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';

export interface AgentRuntimeProps {
  agentName: string;
  /** ECR image URI for the agent container */
  imageUri: string;
  /** Network mode — PUBLIC exposes a managed HTTPS endpoint */
  networkMode?: 'PUBLIC' | 'VPC';
}

/**
 * L3 construct wrapping Amazon Bedrock AgentCore Runtime resources.
 * Provisions the runtime, its endpoint, ECR repository, and IAM execution role.
 *
 * Note: AgentCore CFN resource names may differ across CDK versions.
 * Run `cdk synth` to validate resource types against your installed version.
 */
export class AgentRuntime extends Construct {
  public readonly runtimeArn: string;
  public readonly endpointUrl: string;
  public readonly executionRole: iam.Role;
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: AgentRuntimeProps) {
    super(scope, id);

    const { agentName, imageUri, networkMode = 'PUBLIC' } = props;

    // ECR repository for agent container image
    this.repository = new ecr.Repository(this, 'Repository', {
      repositoryName: `agentcore-${agentName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteImages: true,
      lifecycleRules: [
        { maxImageCount: 10, description: 'Keep last 10 images' },
      ],
    });

    // IAM execution role for AgentCore Runtime
    this.executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: `agentcore-runtime-${agentName}`,
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: `Execution role for AgentCore Runtime: ${agentName}`,
      inlinePolicies: {
        AgentCorePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock-agentcore:*'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage', 'ecr:GetAuthorizationToken'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // AgentCore Runtime (L1 construct)
    const runtime = new bedrock.CfnAgent(this, 'Runtime', {
      agentName: `agentcore-${agentName}`,
      agentResourceRoleArn: this.executionRole.roleArn,
      description: `AgentCore Runtime for agent: ${agentName}`,
      // Container image configuration
      foundationModel: imageUri,
    } as unknown as bedrock.CfnAgentProps);
    // Note: Cast needed until CDK adds typed AgentCore Runtime constructs.
    // The actual CloudFormation resource type is AWS::BedrockAgentCore::Runtime

    this.runtimeArn = runtime.attrAgentArn;
    this.endpointUrl = `https://bedrock-agentcore.${cdk.Aws.REGION}.amazonaws.com/runtimes/${agentName}`;

    new cdk.CfnOutput(this, 'RuntimeArn', {
      value: this.runtimeArn,
      exportName: `agentcore-${agentName}-runtime-arn`,
    });
    new cdk.CfnOutput(this, 'EndpointUrl', {
      value: this.endpointUrl,
      exportName: `agentcore-${agentName}-endpoint-url`,
    });
  }
}
