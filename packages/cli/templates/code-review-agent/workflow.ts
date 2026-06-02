import { getWritable } from 'workflow';
import { DurableAgent } from '@workflow/ai/agent';
import { stepCountIs } from 'ai';
import type { UIMessageChunk } from 'ai';
import type { PullRequestEvent } from '@agentcore/shared';
import { fetchPRDiff, postGitHubComment, storeRunRecord, updateRunRecord } from './steps.js';
import { buildReviewPrompt, SYSTEM_PROMPT } from './prompts.js';

// {{AGENT_NAME}} — code review agent workflow
// Triggered by GitHub pull_request webhook events.

export async function {{AGENT_SAFE_NAME}}Workflow(event: PullRequestEvent): Promise<void> {
  'use workflow';

  const runId = await storeRunRecord({
    agentId: '{{AGENT_SAFE_NAME}}',
    repo: event.repository.full_name,
    prNumber: event.pull_request.number,
    status: 'running',
  });

  const diff = await fetchPRDiff({
    repo: event.repository.full_name,
    prNumber: event.pull_request.number,
  });

  const writable = getWritable<UIMessageChunk>({ namespace: 'agent:output' });

  const agent = new DurableAgent({
    model: '{{AGENT_MODEL}}',
    system: SYSTEM_PROMPT,
    tools: {},
  });

  const result = await agent.stream({
    messages: [{ role: 'user', content: buildReviewPrompt(event, diff) }],
    writable,
    stopWhen: stepCountIs(5),
  });

  const reviewBody = result.messages
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content)
    .join('\n\n');

  await postGitHubComment({
    repo: event.repository.full_name,
    prNumber: event.pull_request.number,
    body: reviewBody,
  });

  await updateRunRecord(runId, { status: 'completed' });
}
