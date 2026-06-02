import { getAgentConfig, updateAgentConfig, deleteAgentConfig } from '@/lib/dynamodb';
import { UpdateAgentSchema } from '@agentcore/shared';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<Response> {
  const { agentId } = await params;
  try {
    const agent = await getAgentConfig(agentId);
    if (!agent) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ agent });
  } catch (error) {
    console.error('[agents/id] GET error', { agentId, error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: 'Failed to get agent' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<Response> {
  const { agentId } = await params;
  try {
    const body = UpdateAgentSchema.parse(await req.json());
    console.log('[agents/id] updating agent', { agentId });
    await updateAgentConfig(agentId, body);
    const updated = await getAgentConfig(agentId);
    return Response.json({ agent: updated });
  } catch (error) {
    console.error('[agents/id] PATCH error', { agentId, error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<Response> {
  const { agentId } = await params;
  try {
    console.log('[agents/id] deleting agent', { agentId });
    await deleteAgentConfig(agentId);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[agents/id] DELETE error', { agentId, error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
