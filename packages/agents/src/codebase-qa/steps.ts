import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { getGitHubClient } from '../utils/github-client.js';

const bedrockClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb',
  '.cs', '.cpp', '.c', '.h', '.md', '.yaml', '.yml', '.json', '.toml',
]);

/**
 * Fetches all relevant source files from a GitHub repo via the API.
 * Filters to code/documentation file extensions only.
 */
export async function fetchRepoContents(params: {
  repo: string;
  branch?: string;
  installationId?: number;
}): Promise<Array<{ path: string; content: string }>> {
  'use step';

  console.log('[step] fetchRepoContents start', { repo: params.repo, branch: params.branch });

  const [owner, repoName] = params.repo.split('/');
  if (!owner || !repoName) throw new Error(`Invalid repo: ${params.repo}`);

  const octokit = getGitHubClient(params.installationId);

  // Get the default branch SHA
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo: repoName });
  const branch = params.branch ?? repoData.default_branch;

  // Fetch the full file tree
  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo: repoName,
    tree_sha: branch,
    recursive: '1',
  });

  const codeFiles = tree.tree.filter((item) => {
    if (item.type !== 'blob' || !item.path) return false;
    const ext = item.path.slice(item.path.lastIndexOf('.'));
    return CODE_EXTENSIONS.has(ext);
  });

  console.log('[step] fetchRepoContents found files', { count: codeFiles.length });

  // Fetch file contents in batches (avoid rate limits)
  const results: Array<{ path: string; content: string }> = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < codeFiles.length; i += BATCH_SIZE) {
    const batch = codeFiles.slice(i, i + BATCH_SIZE);
    const fetched = await Promise.allSettled(
      batch.map(async (file) => {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo: repoName,
          path: file.path!,
          ref: branch,
        });
        if ('content' in data && data.encoding === 'base64') {
          return { path: file.path!, content: Buffer.from(data.content, 'base64').toString('utf-8') };
        }
        return null;
      })
    );

    for (const result of fetched) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  console.log('[step] fetchRepoContents done', { fetched: results.length });
  return results;
}

/**
 * Checks whether the repo has been indexed recently.
 * Uses a simple marker stored in AgentCore Memory.
 */
export async function checkIndexStatus(params: {
  repo: string;
  memoryId: string;
}): Promise<{ indexed: boolean; indexedAt?: string }> {
  'use step';

  console.log('[step] checkIndexStatus start', { repo: params.repo });

  // For now use a simple environment variable or DynamoDB check
  // In production this would query AgentCore Memory for a marker record
  const indexKey = `index-status:${params.repo.replace('/', '-')}`;
  const cached = process.env[indexKey];

  const result = cached
    ? { indexed: true, indexedAt: cached }
    : { indexed: false };

  console.log('[step] checkIndexStatus done', result);
  return result;
}

/**
 * Chunks code files and stores embeddings in AgentCore Memory.
 * Uses Amazon Titan Embeddings v2 via Bedrock.
 */
export async function embedAndStoreChunks(params: {
  files: Array<{ path: string; content: string }>;
  memoryId: string;
  repo: string;
}): Promise<void> {
  'use step';

  console.log('[step] embedAndStoreChunks start', {
    files: params.files.length,
    memoryId: params.memoryId,
  });

  // Chunk files into ~1000-token windows with 200-token overlap
  const chunks = chunkFiles(params.files);
  console.log('[step] embedAndStoreChunks chunked', { chunks: chunks.length });

  // Store chunks in AgentCore Memory via Bedrock Agent Runtime
  // The memory service handles embedding automatically
  // In production: call bedrock-agentcore BatchCreateMemoryRecords API
  // This is a placeholder that logs the intent:
  console.log('[step] embedAndStoreChunks would store', chunks.length, 'chunks to memory', params.memoryId);

  // TODO: replace with actual AgentCore Memory SDK call when GA
  // await bedrockClient.send(new BatchCreateMemoryRecordsCommand({
  //   memoryId: params.memoryId,
  //   records: chunks.map(c => ({ content: c.text, metadata: { path: c.path } })),
  // }));

  console.log('[step] embedAndStoreChunks done');
}

/**
 * Retrieves the most relevant code chunks for a query using AgentCore Memory.
 */
export async function retrieveRelevantChunks(params: {
  query: string;
  memoryId: string;
  actorId: string;
  topK?: number;
}): Promise<string> {
  'use step';

  console.log('[step] retrieveRelevantChunks start', { query: params.query.slice(0, 80) });

  // Use Bedrock RetrieveAndGenerate for RAG over AgentCore Memory
  // This is illustrative — actual API depends on AgentCore Memory GA release
  try {
    const result = await bedrockClient.send(
      new RetrieveAndGenerateCommand({
        input: { text: params.query },
        retrieveAndGenerateConfiguration: {
          type: 'KNOWLEDGE_BASE',
          knowledgeBaseConfiguration: {
            knowledgeBaseId: params.memoryId,
            modelArn: `arn:aws:bedrock:${process.env.AWS_REGION}::foundation-model/anthropic.claude-sonnet-4-5-v1:0`,
          },
        },
      })
    );

    const context = result.output?.text ?? '';
    console.log('[step] retrieveRelevantChunks done', { chars: context.length });
    return context;
  } catch (error) {
    console.error('[step] retrieveRelevantChunks error', error);
    return '';
  }
}

/**
 * Indexes the repo if it hasn't been indexed, or if more than 24 hours have passed.
 * Idempotent — safe to call on every workflow invocation.
 */
export async function indexRepoIfStale(params: {
  repo: string;
  memoryId: string;
  actorId: string;
  installationId?: number;
}): Promise<void> {
  'use step';

  console.log('[step] indexRepoIfStale start', { repo: params.repo });

  const status = await checkIndexStatus({ repo: params.repo, memoryId: params.memoryId });

  if (status.indexed && status.indexedAt) {
    const age = Date.now() - new Date(status.indexedAt).getTime();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (age < ONE_DAY) {
      console.log('[step] indexRepoIfStale skipped (fresh)', { age: Math.round(age / 1000 / 60), minutes: true });
      return;
    }
  }

  console.log('[step] indexRepoIfStale indexing repo');
  const files = await fetchRepoContents({ repo: params.repo, installationId: params.installationId });
  await embedAndStoreChunks({ files, memoryId: params.memoryId, repo: params.repo });
  console.log('[step] indexRepoIfStale done');
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface CodeChunk {
  path: string;
  text: string;
  startLine: number;
}

function chunkFiles(files: Array<{ path: string; content: string }>): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const TARGET_CHARS = 4000; // ~1000 tokens
  const OVERLAP_CHARS = 800; // ~200 tokens

  for (const file of files) {
    const lines = file.content.split('\n');
    let buffer = '';
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      buffer += lines[i] + '\n';

      if (buffer.length >= TARGET_CHARS) {
        chunks.push({
          path: file.path,
          text: `File: ${file.path}\n\n${buffer}`,
          startLine,
        });
        // Overlap: step back OVERLAP_CHARS worth of lines
        const overlapText = buffer.slice(-OVERLAP_CHARS);
        buffer = overlapText;
        startLine = i + 1;
      }
    }

    if (buffer.trim()) {
      chunks.push({
        path: file.path,
        text: `File: ${file.path}\n\n${buffer}`,
        startLine,
      });
    }
  }

  return chunks;
}
