import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { AgentRun } from '@agentcore/shared';
import { randomUUID } from 'crypto';

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
);

const RUNS_TABLE = process.env.DYNAMODB_AGENT_RUNS_TABLE ?? 'agentcore-agent-runs';

export async function createAgentRun(
  run: Omit<AgentRun, 'runId' | 'startedAt'>
): Promise<string> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  // TTL: 90 days from now
  const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

  await ddb.send(
    new PutCommand({
      TableName: RUNS_TABLE,
      Item: { ...run, runId, startedAt, expiresAt },
    })
  );

  return runId;
}

export async function updateAgentRun(
  agentId: string,
  runId: string,
  update: Partial<Pick<AgentRun, 'status' | 'completedAt' | 'outputSummary' | 'errorMessage'>>
): Promise<void> {
  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined) {
      expressions.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = value;
    }
  }

  if (expressions.length === 0) return;

  await ddb.send(
    new UpdateCommand({
      TableName: RUNS_TABLE,
      Key: { agentId, runId },
      UpdateExpression: `SET ${expressions.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function getAgentRun(agentId: string, runId: string): Promise<AgentRun | null> {
  const result = await ddb.send(
    new GetCommand({ TableName: RUNS_TABLE, Key: { agentId, runId } })
  );
  return (result.Item as AgentRun) ?? null;
}
