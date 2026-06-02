import { Command } from 'commander';
import { execSync, spawnSync } from 'child_process';
import { resolve, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import pc from 'picocolors';

export const deployCommand = new Command('deploy')
  .description('Deploy CDK stacks and sync outputs to .env.local')
  .argument('[stack]', 'Specific stack to deploy (omit to deploy all)')
  .option('--diff', 'Show CDK diff only, do not deploy')
  .action(async (stack?: string, opts?: { diff: boolean }) => {
    await runDeploy(stack, opts?.diff ?? false);
  });

async function runDeploy(stack: string | undefined, diffOnly: boolean): Promise<void> {
  const infraPath = findInfraPath();

  // Validate required env vars
  validateEnv();

  console.log(`\n${pc.bold('AgentCore Deploy')}\n`);
  console.log(pc.gray(`  Infra path: ${infraPath}`));

  const stackArg = stack ?? '--all';
  const cmd = diffOnly ? 'diff' : 'deploy';
  const args = diffOnly
    ? ['cdk', 'diff', stackArg]
    : ['cdk', 'deploy', stackArg, '--require-approval', 'never', '--outputs-file', 'cdk-outputs.json'];

  console.log(pc.gray(`  Running: npx ${args.join(' ')}\n`));

  const result = spawnSync('npx', args, {
    cwd: infraPath,
    stdio: 'inherit',
    env: { ...process.env },
  });

  if (result.status !== 0) {
    console.error(pc.red('\n✗ CDK command failed'));
    process.exit(1);
  }

  if (!diffOnly) {
    console.log(pc.green('\n✓ Stacks deployed'));
    await syncOutputsToEnv(infraPath);
  }
}

async function syncOutputsToEnv(infraPath: string): Promise<void> {
  const outputsFile = join(infraPath, 'cdk-outputs.json');
  if (!existsSync(outputsFile)) return;

  try {
    const outputs = JSON.parse(readFileSync(outputsFile, 'utf-8')) as Record<string, Record<string, string>>;
    const envLines: string[] = [];

    // Map CDK output keys to env var names
    const mappings: Record<string, string> = {
      AgentConfigsTableName: 'DYNAMODB_AGENT_CONFIGS_TABLE',
      AgentRunsTableName: 'DYNAMODB_AGENT_RUNS_TABLE',
      ConversationThreadsTableName: 'DYNAMODB_CONVERSATION_THREADS_TABLE',
      DiscordQueueUrl: 'SQS_DISCORD_QUEUE_URL',
      EmailIngestQueueUrl: 'SQS_EMAIL_INGEST_QUEUE_URL',
      EmailBucketName: 'SES_S3_BUCKET',
      WebhookUrl: 'GITHUB_WEBHOOK_URL',
    };

    for (const stackOutputs of Object.values(outputs)) {
      for (const [key, value] of Object.entries(stackOutputs)) {
        const envKey = mappings[key];
        if (envKey) envLines.push(`${envKey}=${value}`);
      }
    }

    if (envLines.length > 0) {
      const envPath = resolve(process.cwd(), '.env.local');
      const existing = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

      let updated = existing;
      for (const line of envLines) {
        const [key] = line.split('=');
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(updated)) {
          updated = updated.replace(regex, line);
        } else {
          updated += `\n${line}`;
        }
      }

      writeFileSync(envPath, updated);
      console.log(pc.green(`✓ Synced ${envLines.length} CDK outputs to .env.local`));
      envLines.forEach((l) => console.log(pc.gray(`  ${l.split('=')[0]}`)));
    }
  } catch (err) {
    console.warn(pc.yellow(`⚠ Could not sync CDK outputs: ${err instanceof Error ? err.message : String(err)}`));
  }
}

function validateEnv(): void {
  const required = ['AWS_ACCOUNT_ID', 'AWS_REGION'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(pc.red(`✗ Missing required env vars: ${missing.join(', ')}`));
    console.error(pc.gray('  Copy .env.example to .env.local and fill in the required values.'));
    process.exit(1);
  }
}

function findInfraPath(): string {
  // Walk up from cwd to find packages/infra
  const candidates = [
    join(process.cwd(), 'packages/infra'),
    join(process.cwd(), '../packages/infra'),
    join(process.cwd(), '../../packages/infra'),
  ];
  for (const p of candidates) {
    if (existsSync(join(p, 'cdk.json'))) return p;
  }
  throw new Error('Could not find packages/infra. Run this command from your project root.');
}
