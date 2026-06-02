export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          Environment variables are managed via{' '}
          <code className="text-orange-400 text-xs">vercel env</code> or your{' '}
          <code className="text-orange-400 text-xs">.env.local</code> file.
        </p>
      </div>

      <Section title="Quick Reference">
        <p className="text-sm text-gray-400 mb-4">
          Run these commands to configure your environment:
        </p>
        <div className="space-y-2">
          {[
            { cmd: 'vercel env pull .env.local', desc: 'Pull env vars from Vercel (provisions VERCEL_OIDC_TOKEN)' },
            { cmd: 'pnpm agentcore deploy', desc: 'Deploy CDK stacks and sync outputs to env' },
            { cmd: 'npx workflow health', desc: 'Check WDK workflow engine health' },
          ].map(({ cmd, desc }) => (
            <div key={cmd} className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-3">
              <code className="text-sm text-orange-400 font-mono">{cmd}</code>
              <p className="text-xs text-gray-500 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Required Environment Variables">
        <EnvTable groups={[
          {
            group: 'AWS',
            vars: ['AWS_ACCOUNT_ID', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
          },
          {
            group: 'AgentCore (set by CDK)',
            vars: ['AGENTCORE_RUNTIME_ARN', 'AGENTCORE_GATEWAY_URL', 'AGENTCORE_MEMORY_ID'],
          },
          {
            group: 'Discord',
            vars: ['DISCORD_BOT_TOKEN', 'DISCORD_APPLICATION_ID', 'DISCORD_PUBLIC_KEY'],
          },
          {
            group: 'GitHub',
            vars: ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET'],
          },
          {
            group: 'SES / Email',
            vars: ['SES_DOMAIN', 'SES_FROM_ADDRESS'],
          },
          {
            group: 'Vercel AI Gateway',
            vars: ['VERCEL_OIDC_TOKEN'],
          },
        ]} />
      </Section>

      <Section title="Links">
        <div className="space-y-2 text-sm">
          {[
            { label: 'AWS Console — Bedrock AgentCore', href: 'https://console.aws.amazon.com/bedrock' },
            { label: 'Discord Developer Portal', href: 'https://discord.com/developers/applications' },
            { label: 'GitHub Apps', href: 'https://github.com/settings/apps' },
            { label: 'Vercel AI Gateway', href: 'https://vercel.com/dashboard' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-orange-400 hover:underline"
            >
              {label} ↗
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <h2 className="text-sm font-medium text-gray-300 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function EnvTable({ groups }: { groups: Array<{ group: string; vars: string[] }> }) {
  return (
    <div className="space-y-4">
      {groups.map(({ group, vars }) => (
        <div key={group}>
          <p className="text-xs text-gray-500 mb-2">{group}</p>
          <div className="space-y-1">
            {vars.map((v) => (
              <div key={v} className="flex items-center gap-3 px-3 py-2 rounded bg-gray-800">
                <code className="text-xs text-green-400 font-mono flex-1">{v}</code>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
