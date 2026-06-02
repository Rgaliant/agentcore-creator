export default function WorkflowsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Workflows</h1>
        <p className="text-sm text-gray-400 mt-1">
          Build and deploy custom agent workflows
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-gray-700 p-12 text-center">
        <p className="text-gray-400 text-lg mb-2">Visual Workflow Builder</p>
        <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
          Connect steps, hooks, and conditions to build durable multi-step agent workflows
          powered by Vercel Workflow DevKit.
        </p>
        <p className="text-xs text-gray-600">
          Install{' '}
          <code className="text-orange-400">@xyflow/react</code>
          {' '}and run{' '}
          <code className="text-orange-400">pnpm dev</code>
          {' '}to enable the visual editor.
        </p>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-4">Pre-built Workflows</h2>
        <div className="space-y-3">
          {[
            {
              name: 'Code Review',
              file: 'src/workflows/code-review-workflow.ts',
              description: 'Reviews GitHub PRs and posts structured comments',
              trigger: 'GitHub webhook',
            },
            {
              name: 'Codebase Q&A',
              file: 'src/workflows/codebase-qa-workflow.ts',
              description: 'Answers questions about your codebase using RAG',
              trigger: 'Discord / Web chat',
            },
            {
              name: 'Discord Agent',
              file: 'src/workflows/discord-agent-workflow.ts',
              description: 'Multi-turn Discord conversation with memory',
              trigger: 'Discord slash command',
            },
            {
              name: 'Email Agent',
              file: 'src/workflows/email-agent-workflow.ts',
              description: 'Reads inbound emails and sends AI-powered replies via SES',
              trigger: 'Inbound email (SES)',
            },
          ].map((wf) => (
            <div key={wf.name} className="flex items-start gap-4 px-4 py-3 rounded-lg border border-gray-800">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">{wf.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{wf.description}</p>
                <code className="text-xs text-gray-600 mt-1 block">{wf.file}</code>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 whitespace-nowrap">
                {wf.trigger}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
