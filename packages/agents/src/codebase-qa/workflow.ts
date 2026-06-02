import { createHook, getWritable } from 'workflow';
import { DurableAgent } from '@workflow/ai/agent';
import { stepCountIs } from 'ai';
import type { UIMessageChunk } from 'ai';
import { indexRepoIfStale, retrieveRelevantChunks } from './steps.js';
import { CODEBASE_QA_SYSTEM_PROMPT } from './prompts.js';
import { createAgentRun, updateAgentRun } from '../utils/dynamodb-client.js';

export interface CodebaseQAParams {
  repo: string;
  memoryId: string;
  channelId: string;
  userId: string;
  initialMessage: string;
  installationId?: number;
}

type ConversationMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Durable multi-turn Q&A workflow for answering questions about a codebase.
 *
 * Flow:
 * 1. Index repo if stale (step — idempotent)
 * 2. Create run record
 * 3. For each user message: RAG retrieve → DurableAgent answers
 * 4. Loop via createHook until user sends done:true
 *    Hook token: `qa-{channelId}-{userId}` (deterministic for resume)
 */
export async function codebaseQAWorkflow(params: CodebaseQAParams): Promise<void> {
  'use workflow';

  console.log('[workflow] codebaseQAWorkflow start', {
    repo: params.repo,
    channelId: params.channelId,
    userId: params.userId,
  });

  // Step 1: Ensure repo is indexed
  await indexRepoIfStale({
    repo: params.repo,
    memoryId: params.memoryId,
    actorId: params.userId,
    installationId: params.installationId,
  });

  // Step 2: Create run record
  const runId = await storeInitialRun(params);
  console.log('[workflow] run record created', { runId });

  // Step 3: Set up multi-turn hook
  const hook = createHook<{ text: string; done?: boolean }>({
    token: `qa-${params.channelId}-${params.userId}`,
  });

  const conversationHistory: ConversationMessage[] = [];

  // Process first message immediately, then loop on hook events
  const events = mergeInitialWithHook(params.initialMessage, hook);

  for await (const event of events) {
    console.log('[workflow] processing message', { text: event.text.slice(0, 80) });

    await processQATurn({
      query: event.text,
      repo: params.repo,
      memoryId: params.memoryId,
      actorId: params.userId,
      history: conversationHistory,
    });

    if (event.done) {
      console.log('[workflow] session ended by user');
      break;
    }
  }

  await finalizeRun('codebase-qa', runId);
  console.log('[workflow] codebaseQAWorkflow complete', { runId });
}

// ── Step functions ────────────────────────────────────────────────────────────

async function storeInitialRun(params: CodebaseQAParams): Promise<string> {
  'use step';

  console.log('[step] storeInitialRun start', { repo: params.repo });
  const runId = await createAgentRun({
    agentId: 'codebase-qa',
    status: 'running',
    channel: params.channelId.startsWith('discord') ? 'discord' : 'web',
    inputSummary: params.initialMessage.slice(0, 200),
  });
  console.log('[step] storeInitialRun done', { runId });
  return runId;
}

async function processQATurn(params: {
  query: string;
  repo: string;
  memoryId: string;
  actorId: string;
  history: ConversationMessage[];
}): Promise<void> {
  'use step';

  console.log('[step] processQATurn start', { query: params.query.slice(0, 80) });

  // RAG: retrieve relevant code chunks
  const context = await retrieveRelevantChunks({
    query: params.query,
    memoryId: params.memoryId,
    actorId: params.actorId,
    topK: 8,
  });

  // Add user message to history
  params.history.push({ role: 'user', content: params.query });

  // Model routes through Vercel AI Gateway. Run `vercel env pull` to
  // provision VERCEL_OIDC_TOKEN (preferred auth, auto-refreshes on Vercel).
  const agent = new DurableAgent({
    model: 'anthropic/claude-sonnet-4.6',
    system: CODEBASE_QA_SYSTEM_PROMPT(params.repo, context),
  });

  const result = await agent.stream({
    messages: params.history.map((m) => ({ role: m.role, content: m.content })),
    writable: getWritable<UIMessageChunk>(),
    stopWhen: stepCountIs(3),
  });

  // Extract assistant response and add to history
  const responseText = extractTextContent(result.messages);
  params.history.push({ role: 'assistant', content: responseText });

  console.log('[step] processQATurn done', { responseChars: responseText.length });
}

async function finalizeRun(agentId: string, runId: string): Promise<void> {
  'use step';

  console.log('[step] finalizeRun start', { agentId, runId });
  await updateAgentRun(agentId, runId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
  console.log('[step] finalizeRun done', { agentId, runId });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates an async iterable that yields the initial message, then all hook events */
async function* mergeInitialWithHook(
  initial: string,
  hook: AsyncIterable<{ text: string; done?: boolean }>
): AsyncIterable<{ text: string; done?: boolean }> {
  yield { text: initial };
  for await (const event of hook) {
    yield event;
  }
}

function extractTextContent(messages: Array<{ role: string; content: unknown }>): string {
  return messages
    .filter((m) => m.role === 'assistant')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('\n');
}
