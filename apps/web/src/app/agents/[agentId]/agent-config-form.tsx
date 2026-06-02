'use client';

import { useState } from 'react';
import type { AgentConfig } from '@agentcore/shared';

export function AgentConfigFormClient({ agent }: { agent: AgentConfig }) {
  const [form, setForm] = useState({
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.systemPrompt ?? '',
    githubRepo: agent.githubRepo ?? '',
    channels: agent.channels,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(ch: AgentConfig['channels'][number]) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter((c) => c !== ch)
        : [...f.channels, ch],
    }));
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 space-y-5">
      <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Configuration</h2>

      <Field label="Name">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500"
        />
      </Field>

      <Field label="Description">
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500"
        />
      </Field>

      <Field label="System Prompt">
        <textarea
          value={form.systemPrompt}
          onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
          rows={5}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-orange-500 resize-none"
        />
      </Field>

      <Field label="GitHub Repo">
        <input
          value={form.githubRepo}
          onChange={(e) => setForm({ ...form, githubRepo: e.target.value })}
          placeholder="owner/repo"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500"
        />
      </Field>

      <Field label="Channels">
        <div className="flex gap-2">
          {(['discord', 'email', 'web'] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                form.channels.includes(ch)
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </Field>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
