import { listAgentConfigs, listRecentRuns } from '@/lib/dynamodb';
import type { AgentConfig, AgentRun } from '@agentcore/shared';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let agents: AgentConfig[] = [];
  let runs: AgentRun[] = [];

  try {
    [agents, runs] = await Promise.all([listAgentConfigs(), listRecentRuns(undefined, 10)]);
  } catch {
    // DynamoDB not configured yet — show empty state
  }

  const activeAgents = agents.filter((a) => a.status === 'active');
  const todayRuns = runs.filter(
    (r) => new Date(r.startedAt).toDateString() === new Date().toDateString()
  );
  const successRate =
    todayRuns.length > 0
      ? Math.round((todayRuns.filter((r) => r.status === 'completed').length / todayRuns.length) * 100)
      : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Your AgentCore platform at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Agents" value={activeAgents.length} sub={`of ${agents.length} total`} />
        <StatCard label="Runs Today" value={todayRuns.length} sub="across all agents" />
        <StatCard label="Success Rate" value={`${successRate}%`} sub="today" />
      </div>

      {/* Agents table */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Agents</h2>
        {agents.length === 0 ? (
          <EmptyState message="No agents yet." action={{ label: 'Create your first agent', href: '/agents' }} />
        ) : (
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Channels</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <a href={`/agents/${agent.id}`} className="text-orange-400 hover:underline font-medium">
                        {agent.name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{agent.type}</td>
                    <td className="px-4 py-3 text-gray-400">{agent.channels.join(', ')}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={agent.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent runs */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Recent Runs</h2>
        {runs.length === 0 ? (
          <EmptyState message="No runs yet. Start chatting or set up a webhook." action={null} />
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <RunRow key={run.runId} run={run} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentConfig['status'] }) {
  const colors: Record<AgentConfig['status'], string> = {
    active: 'bg-green-500/10 text-green-400',
    inactive: 'bg-gray-500/10 text-gray-400',
    error: 'bg-red-500/10 text-red-400',
    deploying: 'bg-yellow-500/10 text-yellow-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>{status}</span>
  );
}

function RunRow({ run }: { run: AgentRun }) {
  const channelIcons: Record<string, string> = { discord: '◎', email: '✉', web: '◈', github: '◑' };
  const statusColors: Record<string, string> = {
    running: 'text-yellow-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    paused: 'text-blue-400',
  };
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-800 bg-gray-900 text-sm">
      <span className="text-gray-500">{channelIcons[run.channel] ?? '◎'}</span>
      <span className="flex-1 text-gray-300 truncate">{run.inputSummary}</span>
      <span className="text-gray-500 text-xs">{run.agentId}</span>
      <span className={`text-xs font-medium ${statusColors[run.status] ?? 'text-gray-400'}`}>
        {run.status}
      </span>
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action: { label: string; href: string } | null }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-700 p-8 text-center">
      <p className="text-gray-500 text-sm">{message}</p>
      {action && (
        <a href={action.href} className="mt-3 inline-block text-orange-400 text-sm hover:underline">
          {action.label} →
        </a>
      )}
    </div>
  );
}
