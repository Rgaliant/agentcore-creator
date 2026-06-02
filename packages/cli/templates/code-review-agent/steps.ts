import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

// {{AGENT_NAME}} — step functions

interface FetchPRDiffParams {
  repo: string;
  prNumber: number;
  installationId?: number;
}

export async function fetchPRDiff(params: FetchPRDiffParams): Promise<string> {
  'use step';
  console.log('[step] fetchPRDiff start', params);

  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(
    `https://api.github.com/repos/${params.repo}/pulls/${params.prNumber}`,
    {
      headers: {
        Accept: 'application/vnd.github.v3.diff',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const diff = await res.text();
  console.log('[step] fetchPRDiff done', { chars: diff.length });
  return diff;
}

interface PostCommentParams {
  repo: string;
  prNumber: number;
  body: string;
}

export async function postGitHubComment(params: PostCommentParams): Promise<void> {
  'use step';
  console.log('[step] postGitHubComment start', { repo: params.repo, prNumber: params.prNumber });

  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(
    `https://api.github.com/repos/${params.repo}/issues/${params.prNumber}/comments`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: params.body }),
    }
  );

  if (!res.ok) throw new Error(`GitHub comment ${res.status}: ${res.statusText}`);
  console.log('[step] postGitHubComment done');
}

interface RunRecord {
  agentId: string;
  repo: string;
  prNumber: number;
  status: string;
}

export async function storeRunRecord(run: RunRecord): Promise<string> {
  'use step';
  const runId = `${run.agentId}-pr${run.prNumber}-${Date.now()}`;
  const table = process.env.DYNAMODB_AGENT_RUNS_TABLE;
  if (!table) return runId;

  const client = new DynamoDBClient({ region: process.env.AWS_REGION });
  await client.send(
    new PutItemCommand({
      TableName: table,
      Item: marshall({ ...run, runId, startedAt: new Date().toISOString() }),
    })
  );
  return runId;
}

export async function updateRunRecord(
  runId: string,
  updates: { status: string; error?: string }
): Promise<void> {
  'use step';
  const table = process.env.DYNAMODB_AGENT_RUNS_TABLE;
  if (!table) return;

  const client = new DynamoDBClient({ region: process.env.AWS_REGION });
  await client.send(
    new UpdateItemCommand({
      TableName: table,
      Key: marshall({ runId }),
      UpdateExpression: 'SET #s = :s, completedAt = :ca',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: marshall({
        ':s': updates.status,
        ':ca': new Date().toISOString(),
      }),
    })
  );
}
