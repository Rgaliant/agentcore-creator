import { listAgentConfigs, createAgentConfig } from '@/lib/dynamodb';
import { CreateAgentSchema } from '@agentcore/shared';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    console.log('[agents] listing agent configs');
    const agents = await listAgentConfigs();
    return Response.json({ agents });
  } catch (error) {
    console.error('[agents] GET error', { error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: 'Failed to list agents' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = CreateAgentSchema.parse(await req.json());
    console.log('[agents] creating agent', { name: body.name, type: body.type });
    const agent = await createAgentConfig(body);
    console.log('[agents] created', { id: agent.id });
    return Response.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('[agents] POST error', { error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
