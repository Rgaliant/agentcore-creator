import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { AgentConfig, AgentRun } from '@agentcore/shared';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
);

const CONFIGS_TABLE = process.env.DYNAMODB_AGENT_CONFIGS_TABLE ?? 'agentcore-agent-configs';
const RUNS_TABLE = process.env.DYNAMODB_AGENT_RUNS_TABLE ?? 'agentcore-agent-runs';

// ── Agent Configs ─────────────────────────────────────────────────────────────

export async function listAgentConfigs(): Promise<AgentConfig[]> {
  const result = await client.send(new ScanCommand({ TableName: CONFIGS_TABLE }));
  return (result.Items ?? []) as AgentConfig[];
}

export async function getAgentConfig(agentId: string): Promise<AgentConfig | null> {
  const result = await client.send(
    new GetCommand({ TableName: CONFIGS_TABLE, Key: { agentId } })
  );
  return (result.Item as AgentConfig) ?? null;
}

export async function createAgentConfig(
  config: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<AgentConfig> {
  const now = new Date().toISOString();
  const item: AgentConfig = {
    ...config,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await client.send(new PutCommand({ TableName: CONFIGS_TABLE, Item: item }));
  return item;
}

export async function updateAgentConfig(
  agentId: string,
  updates: Partial<Omit<AgentConfig, 'id' | 'createdAt'>>
): Promise<void> {
  const expressions: string[] = ['#updatedAt = :updatedAt'];
  const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
  const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      expressions.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = value;
    }
  }

  await client.send(
    new UpdateCommand({
      TableName: CONFIGS_TABLE,
      Key: { agentId },
      UpdateExpression: `SET ${expressions.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function deleteAgentConfig(agentId: string): Promise<void> {
  await client.send(new DeleteCommand({ TableName: CONFIGS_TABLE, Key: { agentId } }));
}

// ── Agent Runs ────────────────────────────────────────────────────────────────

export async function listRecentRuns(agentId?: string, limit = 20): Promise<AgentRun[]> {
  if (agentId) {
    const result = await client.send(
      new QueryCommand({
        TableName: RUNS_TABLE,
        KeyConditionExpression: 'agentId = :agentId',
        ExpressionAttributeValues: { ':agentId': agentId },
        Limit: limit,
        ScanIndexForward: false, // newest first
      })
    );
    return (result.Items ?? []) as AgentRun[];
  }

  const result = await client.send(
    new ScanCommand({ TableName: RUNS_TABLE, Limit: limit })
  );
  return (result.Items ?? []) as AgentRun[];
}
