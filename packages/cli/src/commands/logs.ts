import { Command } from 'commander';
import { spawnSync } from 'child_process';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import pc from 'picocolors';

export const logsCommand = new Command('logs')
  .description('View recent runs and logs for an agent')
  .argument('<agentId>', 'Agent ID to fetch logs for')
  .option('-n, --limit <n>', 'Number of recent runs to show', '10')
  .option('--cw', 'Stream raw CloudWatch Logs')
  .option('--workflow', 'Open Vercel Workflow DevKit dashboard')
  .action(async (agentId: string, opts: { limit: string; cw: boolean; workflow: boolean }) => {
    await runLogs(agentId, {
      limit: parseInt(opts.limit, 10),
      cw: opts.cw ?? false,
      workflow: opts.workflow ?? false,
    });
  });

async function runLogs(
  agentId: string,
  opts: { limit: number; cw: boolean; workflow: boolean }
): Promise<void> {
  console.log(`\n${pc.bold('AgentCore Logs')} — ${pc.cyan(agentId)}\n`);

  if (opts.workflow) {
    console.log(pc.gray('  Opening Workflow DevKit dashboard…\n'));
    spawnSync('npx', ['workflow', 'inspect', 'runs'], { stdio: 'inherit' });
    return;
  }

  // Show recent runs from DynamoDB
  await showRecentRuns(agentId, opts.limit);

  if (opts.cw) {
    await streamCloudWatchLogs(agentId);
  }
}

async function showRecentRuns(agentId: string, limit: number): Promise<void> {
  const table = process.env.DYNAMODB_AGENT_RUNS_TABLE;
  if (!table) {
    console.warn(pc.yellow('  ⚠ DYNAMODB_AGENT_RUNS_TABLE not set — skipping run history'));
    console.warn(pc.gray('    Run `pnpm agentcore deploy` to populate .env.local'));
    return;
  }

  const region = process.env.AWS_REGION ?? 'us-east-1';
  const client = new DynamoDBClient({ region });

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: 'agentId = :aid',
        ExpressionAttributeValues: { ':aid': { S: agentId } },
        ScanIndexForward: false,
        Limit: limit,
      })
    );

    const runs = (result.Items ?? []).map((item) => unmarshall(item));

    if (runs.length === 0) {
      console.log(pc.gray('  No runs found for this agent.\n'));
      return;
    }

    console.log(pc.bold(`  Recent runs (${runs.length}):\n`));
    for (const run of runs) {
      const status = formatStatus(run.status as string);
      const started = run.startedAt ? new Date(run.startedAt as string).toLocaleString() : '—';
      const duration = run.durationMs ? `${Math.round((run.durationMs as number) / 1000)}s` : '—';
      console.log(
        `  ${status}  ${pc.gray(run.runId as string)}  ${pc.white(started)}  ${pc.gray(duration)}`
      );
      if (run.error) {
        console.log(pc.red(`         Error: ${run.error as string}`));
      }
    }
    console.log();
  } catch (err) {
    console.warn(
      pc.yellow(
        `  ⚠ Could not query DynamoDB: ${err instanceof Error ? err.message : String(err)}`
      )
    );
  }
}

async function streamCloudWatchLogs(agentId: string): Promise<void> {
  const logGroup = `/agentcore/${agentId}`;
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const client = new CloudWatchLogsClient({ region });

  console.log(pc.gray(`  Fetching CloudWatch logs from ${logGroup}…\n`));

  try {
    const since = Date.now() - 60 * 60 * 1000; // last hour
    const result = await client.send(
      new FilterLogEventsCommand({
        logGroupName: logGroup,
        startTime: since,
        limit: 100,
      })
    );

    const events = result.events ?? [];
    if (events.length === 0) {
      console.log(pc.gray('  No CloudWatch log events in the last hour.\n'));
      return;
    }

    for (const event of events) {
      const ts = event.timestamp ? new Date(event.timestamp).toISOString() : '';
      console.log(`${pc.gray(ts)}  ${event.message ?? ''}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ResourceNotFoundException')) {
      console.warn(pc.yellow(`  ⚠ Log group ${logGroup} not found — agent may not have run yet`));
    } else {
      console.warn(pc.yellow(`  ⚠ CloudWatch error: ${msg}`));
    }
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'completed':
      return pc.green('✓ completed');
    case 'failed':
      return pc.red('✗ failed   ');
    case 'running':
      return pc.cyan('⟳ running  ');
    default:
      return pc.gray(`  ${status}   `);
  }
}
