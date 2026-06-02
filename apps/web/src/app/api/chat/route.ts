import { streamText } from 'ai';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const startMs = Date.now();

  try {
    const { messages, agentId } = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      agentId?: string;
    };

    console.log('[chat] streaming response', {
      agentId,
      turns: messages.length,
      ts: new Date().toISOString(),
    });

    // Model routes through Vercel AI Gateway. Run `vercel env pull` to
    // provision VERCEL_OIDC_TOKEN (preferred auth, auto-refreshes on Vercel).
    const result = streamText({
      model: 'anthropic/claude-sonnet-4.6' as Parameters<typeof streamText>[0]['model'],
      system: `You are AgentCore Assistant — a helpful AI for managing AWS AI agents.
You help users understand their agents, view run history, and configure deployments.
Be concise and developer-friendly.`,
      messages,
    });

    console.log('[chat] stream started', { agentId, ms: Date.now() - startMs });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[chat] error', {
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startMs,
    });
    return Response.json({ error: 'Failed to stream response' }, { status: 500 });
  }
}
