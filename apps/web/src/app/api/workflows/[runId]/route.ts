import { getRun } from 'workflow/api';

export const runtime = 'nodejs';

/** GET /api/workflows/:runId — streams workflow output as SSE */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
): Promise<Response> {
  const { runId } = await params;
  console.log('[workflows/runId] streaming run output', { runId, ts: new Date().toISOString() });

  try {
    const run = getRun(runId);
    const stream = run.getReadable();

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[workflows/runId] error', {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: 'Run not found' }, { status: 404 });
  }
}
