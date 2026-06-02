import { getWritable } from 'workflow';
import { DurableAgent } from '@workflow/ai/agent';
import { stepCountIs } from 'ai';
import type { UIMessageChunk } from 'ai';

// {{AGENT_NAME}} — basic agent workflow
// Customize the system prompt, tools, and steps below.

export async function {{AGENT_SAFE_NAME}}Workflow(input: string): Promise<void> {
  'use workflow';

  const agent = new DurableAgent({
    model: '{{AGENT_MODEL}}',
    system: 'You are a helpful AI assistant named {{AGENT_NAME}}.',
    tools: {},
  });

  await agent.stream({
    messages: [{ role: 'user', content: input }],
    writable: getWritable<UIMessageChunk>({ namespace: 'agent:output' }),
    stopWhen: stepCountIs(10),
  });
}
