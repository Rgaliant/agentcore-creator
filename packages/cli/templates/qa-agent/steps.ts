import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

// {{AGENT_NAME}} — step functions

interface IndexParams {
  repo: string;
  memoryId: string;
  actorId: string;
}

export async function indexRepoIfStale(params: IndexParams): Promise<void> {
  'use step';
  console.log('[step] indexRepoIfStale start', params);
  // In production: check DynamoDB for last indexed timestamp, skip if recent (<1h)
  // For now, a no-op placeholder — implement with Titan Embeddings + AgentCore Memory API
  console.log('[step] indexRepoIfStale done (no-op)');
}

interface RetrieveParams {
  query: string;
  memoryId: string;
  actorId: string;
  topK?: number;
}

export async function retrieveRelevantChunks(params: RetrieveParams): Promise<string> {
  'use step';
  console.log('[step] retrieveRelevantChunks start', { query: params.query.slice(0, 80) });

  const region = process.env.AWS_REGION ?? 'us-east-1';
  const client = new BedrockAgentRuntimeClient({ region });

  try {
    const result = await client.send(
      new RetrieveCommand({
        knowledgeBaseId: params.memoryId,
        retrievalQuery: { text: params.query },
        retrievalConfiguration: {
          vectorSearchConfiguration: { numberOfResults: params.topK ?? 5 },
        },
      })
    );

    const chunks = (result.retrievalResults ?? [])
      .map((r) => r.content?.text ?? '')
      .filter(Boolean)
      .join('\n\n---\n\n');

    console.log('[step] retrieveRelevantChunks done', { chunks: chunks.length });
    return chunks;
  } catch (err) {
    console.warn('[step] retrieveRelevantChunks failed, returning empty context', err);
    return '';
  }
}
