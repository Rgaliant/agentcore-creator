'use client';

import { useState } from 'react';

const STACKS = [
  { id: 'AgentStorage', label: 'Agent Storage', description: 'DynamoDB tables for agent configs and runs' },
  { id: 'AgentMessaging', label: 'Messaging', description: 'SQS queues, EventBridge bus, SES inbound email' },
  { id: 'AgentGithubIntegration', label: 'GitHub Integration', description: 'Webhook forwarder Lambda + API Gateway' },
  { id: 'AgentCoreCodeReview', label: 'Code Review Agent', description: 'AgentCore Runtime + Gateway for code review' },
  { id: 'AgentCoreCodebaseQA', label: 'Codebase Q&A Agent', description: 'AgentCore Runtime + Gateway + Memory for Q&A' },
];

export default function DeployPage() {
  const [selected, setSelected] = useState<string[]>(['AgentStorage', 'AgentMessaging']);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function handleDeploy() {
    setStatus('running');
    setLogs([]);

    // Stream CDK deploy logs via SSE
    const res = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stacks: selected }),
    });

    if (!res.body) {
      setStatus('error');
      setLogs(['No response body from deploy API']);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      setLogs((l) => [...l, chunk]);
    }

    setStatus(res.ok ? 'done' : 'error');
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Deploy</h1>
        <p className="text-sm text-gray-400 mt-1">Deploy AWS CDK stacks to your account</p>
      </div>

      {/* Stack selector */}
      <section className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-300">Select Stacks</h2>
        {STACKS.map((stack) => (
          <label key={stack.id} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected.includes(stack.id)}
              onChange={() => toggle(stack.id)}
              className="mt-0.5 accent-orange-500"
            />
            <div>
              <p className="text-sm text-gray-200 group-hover:text-white transition-colors">{stack.label}</p>
              <p className="text-xs text-gray-500">{stack.description}</p>
            </div>
          </label>
        ))}
      </section>

      {/* Deploy button */}
      <button
        onClick={handleDeploy}
        disabled={status === 'running' || selected.length === 0}
        className="px-6 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {status === 'running' ? 'Deploying…' : status === 'done' ? '✓ Deployed' : 'Deploy Selected Stacks'}
      </button>

      {/* Logs */}
      {logs.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-400 mb-2">Deploy Output</h2>
          <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs text-gray-300 font-mono overflow-auto max-h-80 whitespace-pre-wrap">
            {logs.join('')}
          </pre>
        </section>
      )}
    </div>
  );
}
