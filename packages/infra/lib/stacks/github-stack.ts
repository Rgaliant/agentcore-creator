import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

export interface GithubIntegrationStackProps extends cdk.StackProps {
  /** Vercel web app URL — webhook Lambda forwards verified events here */
  vercelWebhookUrl: string;
}

/**
 * Provisions a public API Gateway + Lambda forwarder for GitHub webhooks.
 * The Lambda validates the GitHub HMAC signature before forwarding to Vercel.
 * GitHub secret is stored in SSM Parameter Store.
 *
 * Deploy once per environment: cdk deploy AgentGithubIntegration
 */
export class GithubIntegrationStack extends cdk.Stack {
  public readonly webhookUrl: string;

  constructor(scope: Construct, id: string, props: GithubIntegrationStackProps) {
    super(scope, id, props);

    const { vercelWebhookUrl } = props;

    console.log('[GithubIntegrationStack] Synthesizing GitHub webhook infrastructure');
    console.log(`[GithubIntegrationStack] Target Vercel URL: ${vercelWebhookUrl}`);

    // SSM parameters (values set manually or via agentcore deploy)
    const webhookSecretParam = new ssm.StringParameter(this, 'WebhookSecretParam', {
      parameterName: '/agentcore/github/webhook-secret',
      stringValue: 'REPLACE_WITH_YOUR_WEBHOOK_SECRET',
      description: 'GitHub App webhook secret for HMAC validation',
    });

    new ssm.StringParameter(this, 'VercelWebhookUrlParam', {
      parameterName: '/agentcore/vercel/webhook-url',
      stringValue: vercelWebhookUrl,
      description: 'Vercel API route for forwarding GitHub webhook events',
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'WebhookLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    webhookSecretParam.grantRead(lambdaRole);

    // Webhook forwarder Lambda
    const webhookLambda = new lambdaNode.NodejsFunction(this, 'WebhookLambda', {
      functionName: 'agentcore-github-webhook',
      entry: path.join(__dirname, '../../lambda/github-webhook-forwarder.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(15),
      environment: {
        VERCEL_WEBHOOK_URL: vercelWebhookUrl,
        WEBHOOK_SECRET_PARAM: webhookSecretParam.parameterName,
      },
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'node20',
      },
    });

    // API Gateway REST API
    const api = new apigateway.RestApi(this, 'WebhookApi', {
      restApiName: 'agentcore-github-webhook',
      description: 'Public endpoint for receiving GitHub webhook events',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
      },
    });

    const webhookResource = api.root.addResource('webhook').addResource('github');
    webhookResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(webhookLambda, { proxy: true }),
      { apiKeyRequired: false }
    );

    this.webhookUrl = `${api.url}webhook/github`;

    new cdk.CfnOutput(this, 'WebhookUrl', {
      value: this.webhookUrl,
      exportName: 'agentcore-github-webhook-url',
      description: 'Set this as your GitHub App webhook URL',
    });

    cdk.Tags.of(this).add('agentcore:component', 'github-integration');
    cdk.Tags.of(this).add('agentcore:managed', 'true');
  }
}
