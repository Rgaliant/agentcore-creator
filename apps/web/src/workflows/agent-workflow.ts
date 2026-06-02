import { getWritable } from 'workflow';
import { DurableAgent } from '@workflow/ai/agent';
import { stepCountIs } from 'ai';
import type { UIMessageChunk } from 'ai';
import type { WorkflowStartParams } from '@agentcore/shared';
import { getAgentConfig } from '@/lib/dynamodb';
import { updateAgentRun } from '@agentcore/agents';

/**
 * Generic durable agent workflow — used by /api/workflows/start for web UI chat.
 * Loads the agent config from DynamoDB, builds a system prompt, and streams the response.
 */
export async function agentWorkflow(params: WorkflowStartParams): Promise<void> {
  'use workflow';

  console.log('[workflow] agentWorkflow start', { agentId: params.agentId, channel: params.channel });

  await runAgentTurn(params);

  console.log('[workflow] agentWorkflow complete', { agentId: params.agentId });
}

// ── Step functions ────────────────────────────────────────────────────────────

async function runAgentTurn(params: WorkflowStartParams): Promise<void> {
  'use step';

  console.log('[step] runAgentTurn start', { agentId: params.agentId });

  // Load agent config to get system prompt and model
  const config = await getAgentConfig(params.agentId);
  const systemPrompt = config?.systemPrompt ?? `You are ${config?.name ?? 'an AI assistant'}. ${config?.description ?? ''}`;

  // Model routes through Vercel AI Gateway. Run `vercel env pull` to
  // provision VERCEL_OIDC_TOKEN (preferred auth, auto-refreshes on Vercel).
  const agent = new DurableAgent({
    model: 'anthropic/claude-sonnet-4.6',
    system: systemPrompt,
  });

  const result = await agent.stream({
    messages: [{ role: 'user', content: params.message }],
    writable: getWritable<UIMessageChunk>(),
    stopWhen: stepCountIs(5),
  });

  const responseText = result.messages
    .filter((m) => m.role === 'assistant')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('\n');

  console.log('[step] runAgentTurn done', { chars: responseText.length });
}
