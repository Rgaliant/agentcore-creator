import { notFound } from 'next/navigation';
import { getAgentConfig, listRecentRuns } from '@/lib/dynamodb';
import { AgentConfigFormClient } from './agent-config-form';

export const dynamic = 'force-dynamic';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const agent = await getAgentConfig(agentId);
  if (!agent) notFound();

  const runs = await listRecentRuns(agentId, 10);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">{agent.name}</h1>
        <p className="text-sm text-gray-400 mt-1">{agent.description}</p>
      </div>

      <AgentConfigFormClient agent={agent} />

      {/* Run History */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
          Recent Runs
        </h2>
        {runs.length === 0 ? (
          <p className="text-gray-500 text-sm">No runs yet.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.runId} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-800 bg-gray-900 text-sm">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  run.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                  run.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                  run.status === 'running' ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-gray-500/10 text-gray-400'
                }`}>{run.status}</span>
                <span className="flex-1 text-gray-300 truncate">{run.inputSummary}</span>
                <span className="text-gray-500 text-xs">{run.channel}</span>
                <span className="text-gray-600 text-xs">{new Date(run.startedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
