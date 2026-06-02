#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AgentCoreStack } from '../lib/stacks/agent-core-stack.js';
import { AgentStorageStack } from '../lib/stacks/agent-storage-stack.js';
import { MessagingStack } from '../lib/stacks/messaging-stack.js';
import { GithubIntegrationStack } from '../lib/stacks/github-stack.js';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_ACCOUNT ?? process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
};

// ── Always deploy: Storage + Messaging ──────────────────────────────────────
const storage = new AgentStorageStack(app, 'AgentStorage', {
  env,
  description: 'AgentCore Creator — DynamoDB storage tables',
});

const messaging = new MessagingStack(app, 'AgentMessaging', {
  env,
  sesDomain: process.env.SES_DOMAIN ?? 'mail.example.com',
  vercelEmailWebhookUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/channels/email`
    : undefined,
  description: 'AgentCore Creator — SQS, EventBridge, SES messaging',
});

// ── Optional: GitHub Integration ─────────────────────────────────────────────
if (process.env.DEPLOY_GITHUB === 'true' && process.env.NEXT_PUBLIC_APP_URL) {
  new GithubIntegrationStack(app, 'AgentGithubIntegration', {
    env,
    vercelWebhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/github`,
    description: 'AgentCore Creator — GitHub webhook forwarder',
  });
}

// ── Optional: Code Review Agent ───────────────────────────────────────────────
if (process.env.DEPLOY_CODE_REVIEW === 'true' && process.env.CODE_REVIEW_IMAGE_URI) {
  new AgentCoreStack(app, 'AgentCoreCodeReview', {
    env,
    agentName: 'code-review',
    imageUri: process.env.CODE_REVIEW_IMAGE_URI,
    enableGateway: true,
    enableMemory: false,
    description: 'AgentCore Creator — Code Review agent runtime + gateway',
  });
}

// ── Optional: Codebase Q&A Agent ──────────────────────────────────────────────
if (process.env.DEPLOY_CODEBASE_QA === 'true' && process.env.CODEBASE_QA_IMAGE_URI) {
  new AgentCoreStack(app, 'AgentCoreCodebaseQA', {
    env,
    agentName: 'codebase-qa',
    imageUri: process.env.CODEBASE_QA_IMAGE_URI,
    enableGateway: true,
    enableMemory: true,
    description: 'AgentCore Creator — Codebase Q&A agent runtime + gateway + memory',
  });
}

// Suppress unused variable warnings — storage/messaging are used for resource exports
void storage;
void messaging;
