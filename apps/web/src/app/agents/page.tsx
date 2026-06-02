import Link from 'next/link';
import { listAgentConfigs } from '@/lib/dynamodb';
import type { AgentConfig } from '@agentcore/shared';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  let agents: AgentConfig[] = [];
  try {
    agents = await listAgentConfigs();
  } catch {
    // DynamoDB not configured yet
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Agents</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your AI agents</p>
        </div>
        <Link
          href="/agents/new"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Agent
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-700 p-12 text-center">
          <p className="text-gray-400 text-lg mb-2">No agents yet</p>
          <p className="text-gray-500 text-sm mb-6">
            Create your first agent or deploy a pre-built one.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/agents/new?template=code-review" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm transition-colors">
              Code Review Agent
            </Link>
            <Link href="/agents/new?template=codebase-qa" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm transition-colors">
              Codebase Q&A Agent
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentConfig }) {
  const typeColors: Record<AgentConfig['type'], string> = {
    'code-review': 'text-purple-400 bg-purple-500/10',
    'codebase-qa': 'text-blue-400 bg-blue-500/10',
    custom: 'text-gray-400 bg-gray-500/10',
  };
  const statusDot: Record<AgentConfig['status'], string> = {
    active: 'bg-green-400',
    inactive: 'bg-gray-500',
    error: 'bg-red-400',
    deploying: 'bg-yellow-400 animate-pulse',
  };

  return (
    <Link href={`/agents/${agent.id}`}>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 hover:border-gray-600 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusDot[agent.status]}`} />
              <h3 className="font-medium text-white">{agent.name}</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">{agent.description || 'No description'}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeColors[agent.type]}`}>
            {agent.type}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Channels: {agent.channels.join(', ')}</span>
          {agent.githubRepo && <span>· {agent.githubRepo}</span>}
        </div>
      </div>
    </Link>
  );
}
