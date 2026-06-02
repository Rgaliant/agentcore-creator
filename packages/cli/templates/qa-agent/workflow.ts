import { createHook, getWritable } from 'workflow';
import { DurableAgent } from '@workflow/ai/agent';
import { stepCountIs } from 'ai';
import type { UIMessageChunk } from 'ai';
import { indexRepoIfStale, retrieveRelevantChunks } from './steps.js';
import { SYSTEM_PROMPT, buildQAPrompt } from './prompts.js';

// {{AGENT_NAME}} — codebase Q&A agent workflow
// Multi-turn: uses a hook to receive follow-up questions from the same channel session.

interface QAInput {
  repo: string;
  memoryId: string;
  channelId: string;
  userId: string;
  initialMessage: string;
}

export async function {{AGENT_SAFE_NAME}}Workflow(params: QAInput): Promise<void> {
  'use workflow';

  // Ensure repo is indexed in AgentCore Memory
  await indexRepoIfStale({ repo: params.repo, memoryId: params.memoryId, actorId: params.userId });

  const hook = createHook<{ text: string; done?: boolean }>({
    token: `qa-${params.channelId}-${params.userId}`,
  });

  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Process initial message then loop on follow-up hook events
  async function* messages() {
    yield { text: params.initialMessage };
    for await (const event of hook) {
      yield event;
    }
  }

  for await (const event of messages()) {
    if (event.done) break;

    const context = await retrieveRelevantChunks({
      query: event.text,
      memoryId: params.memoryId,
      actorId: params.userId,
    });

    const agent = new DurableAgent({
      model: '{{AGENT_MODEL}}',
      system: SYSTEM_PROMPT,
      tools: {},
    });

    history.push({ role: 'user', content: event.text });

    const result = await agent.stream({
      messages: [
        ...history,
        { role: 'user', content: buildQAPrompt(event.text, context) },
      ],
      writable: getWritable<UIMessageChunk>({ namespace: 'agent:output' }),
      stopWhen: stepCountIs(5),
    });

    const assistantReply = result.messages
      .filter((m) => m.role === 'assistant')
      .map((m) => m.content)
      .join('\n\n');

    history.push({ role: 'assistant', content: assistantReply });
  }
}
