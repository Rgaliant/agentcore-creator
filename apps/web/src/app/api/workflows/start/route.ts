import { start } from 'workflow/api';
import { WorkflowStartSchema } from '@agentcore/shared';
import type { WorkflowStartResult } from '@agentcore/shared';
import { createAgentRun } from '@agentcore/agents';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const startMs = Date.now();

  try {
    const body = WorkflowStartSchema.parse(await req.json());
    console.log('[workflows/start] starting workflow', { agentId: body.agentId, channel: body.channel });

    // Import workflow lazily based on agentId to keep bundle lean
    const { agentWorkflow } = await import('@/workflows/agent-workflow');

    const run = await start(agentWorkflow, [body]);

    const agentRunId = await createAgentRun({
      agentId: body.agentId,
      status: 'running',
      channel: body.channel,
      inputSummary: body.message.slice(0, 200),
      workflowRunId: run.runId,
    });

    const result: WorkflowStartResult = { runId: run.runId, agentRunId };

    console.log('[workflows/start] started', { ...result, ms: Date.now() - startMs });
    return Response.json(result);
  } catch (error) {
    console.error('[workflows/start] error', {
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startMs,
    });
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
