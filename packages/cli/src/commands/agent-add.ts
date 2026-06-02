import { Command } from 'commander';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import pc from 'picocolors';

const TEMPLATES = ['basic-agent', 'code-review-agent', 'qa-agent'] as const;
type AgentTemplate = (typeof TEMPLATES)[number];

const MODEL_OPTIONS = [
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-haiku-4.5',
  'openai/gpt-5.4',
] as const;

const CHANNEL_OPTIONS = ['discord', 'email', 'web'] as const;

export const agentAddCommand = new Command('agent')
  .description('Manage agents')
  .addCommand(
    new Command('add')
      .description('Add a new agent from a template')
      .argument('<template>', `Template to use (${TEMPLATES.join(', ')})`)
      .option('--name <name>', 'Agent name (skip prompt)')
      .option('--model <model>', 'Model ID (skip prompt)')
      .option('--channels <channels>', 'Comma-separated channels: discord,email,web (skip prompt)')
      .action(async (template: string, opts: { name?: string; model?: string; channels?: string }) => {
        await runAgentAdd(template as AgentTemplate, opts);
      })
  );

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const displayDefault = defaultValue ? pc.gray(` (${defaultValue})`) : '';
  return new Promise((resolve) => {
    rl.question(`${question}${displayDefault}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function runAgentAdd(
  template: AgentTemplate,
  opts: { name?: string; model?: string; channels?: string }
): Promise<void> {
  if (!TEMPLATES.includes(template)) {
    console.error(pc.red(`✗ Unknown template "${template}". Available: ${TEMPLATES.join(', ')}`));
    process.exit(1);
  }

  console.log(`\n${pc.bold('AgentCore')} — adding agent from ${pc.cyan(template)} template\n`);

  // Gather agent config
  const name = opts.name ?? (await prompt('Agent name', template));
  const safeName = name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

  const model = opts.model ?? (await prompt('Model', MODEL_OPTIONS[0]));

  const channelsRaw =
    opts.channels ??
    (await prompt('Channels (comma-separated)', 'discord'));
  const channels = channelsRaw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  // Find project root
  const projectRoot = findProjectRoot();
  const agentsDir = join(projectRoot, 'packages', 'agents', 'src');
  const agentDir = join(agentsDir, safeName);
  const workflowsDir = join(projectRoot, 'apps', 'web', 'src', 'workflows');

  if (existsSync(agentDir)) {
    console.error(pc.red(`✗ Agent directory already exists: ${agentDir}`));
    process.exit(1);
  }

  // Copy template files
  const templateDir = join(__dirname, '../../templates', template);
  if (!existsSync(templateDir)) {
    console.error(pc.red(`✗ Template not found: ${templateDir}`));
    process.exit(1);
  }

  console.log(pc.gray('\n  Copying template files…'));
  mkdirSync(agentDir, { recursive: true });
  cpSync(templateDir, agentDir, { recursive: true });

  // Patch template files with agent config
  const templateVars: Record<string, string> = {
    '{{AGENT_NAME}}': name,
    '{{AGENT_SAFE_NAME}}': safeName,
    '{{AGENT_MODEL}}': model,
    '{{AGENT_CHANNELS}}': JSON.stringify(channels),
  };

  patchDirectory(agentDir, templateVars);
  console.log(pc.green('  ✓ Agent files created'));

  // Scaffold workflow file in apps/web
  if (existsSync(workflowsDir)) {
    const workflowFile = join(workflowsDir, `${safeName}-workflow.ts`);
    const workflowContent = generateWorkflowFile(safeName, name, model, channels, template);
    writeFileSync(workflowFile, workflowContent);
    console.log(pc.green(`  ✓ Workflow scaffolded at apps/web/src/workflows/${safeName}-workflow.ts`));
  }

  // Append CDK instantiation hint to infra/bin/app.ts
  const appTs = join(projectRoot, 'packages', 'infra', 'bin', 'app.ts');
  if (existsSync(appTs)) {
    appendCdkHint(appTs, safeName, name);
    console.log(pc.green('  ✓ CDK stub appended to packages/infra/bin/app.ts'));
  }

  console.log(`
${pc.bold('Done!')} Agent ${pc.cyan(name)} added.

${pc.bold('Next steps:')}

  1. Edit ${pc.gray(`packages/agents/src/${safeName}/workflow.ts`)} to implement your agent logic

  2. Register the new CDK stack in ${pc.gray('packages/infra/bin/app.ts')}

  3. Deploy:
     ${pc.cyan('pnpm agentcore deploy')}
`);
}

function patchDirectory(dir: string, vars: Record<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      patchDirectory(full, vars);
    } else if (full.endsWith('.ts') || full.endsWith('.json') || full.endsWith('.md')) {
      let content = readFileSync(full, 'utf-8');
      for (const [k, v] of Object.entries(vars)) {
        content = content.replaceAll(k, v);
      }
      writeFileSync(full, content);
    }
  }
}

function generateWorkflowFile(
  safeName: string,
  name: string,
  model: string,
  channels: string[],
  template: AgentTemplate
): string {
  const importName = toPascalCase(safeName) + 'Workflow';

  if (template === 'code-review-agent') {
    return `// Auto-generated workflow wrapper for ${name}
// Edit packages/agents/src/${safeName}/workflow.ts to implement logic
export { codeReviewWorkflow as ${importName} } from '@agentcore/agents/code-review/workflow';
`;
  }

  if (template === 'qa-agent') {
    return `// Auto-generated workflow wrapper for ${name}
// Edit packages/agents/src/${safeName}/workflow.ts to implement logic
export { codebaseQAWorkflow as ${importName} } from '@agentcore/agents/codebase-qa/workflow';
`;
  }

  // basic-agent
  const hasDiscord = channels.includes('discord');
  return `// Auto-generated workflow for ${name}
// Edit this file and packages/agents/src/${safeName}/workflow.ts to implement logic
import { createHook, getWritable } from 'workflow';
import { DurableAgent } from '@workflow/ai/agent';
import { stepCountIs } from 'ai';
import type { UIMessageChunk } from 'ai';
${hasDiscord ? "import type { DiscordMessage } from '@agentcore/shared';" : ''}

export async function ${importName}(${hasDiscord ? 'discordMsg: DiscordMessage' : 'input: string'}): Promise<void> {
  'use workflow';

  const agent = new DurableAgent({
    model: '${model}',
    system: 'You are a helpful AI assistant named ${name}.',
    tools: {},
  });

  await agent.stream({
    messages: [{ role: 'user', content: ${hasDiscord ? 'discordMsg.content' : 'input'} }],
    writable: getWritable<UIMessageChunk>({ namespace: 'agent:output' }),
    stopWhen: stepCountIs(5),
  });
}
`;
}

function appendCdkHint(appTs: string, safeName: string, name: string): void {
  const content = readFileSync(appTs, 'utf-8');
  const hint = `
// TODO: Add ${name} stack
// const ${toCamelCase(safeName)}Stack = new AgentCoreStack(app, '${toPascalCase(safeName)}Stack', {
//   agentName: '${safeName}',
//   imageUri: process.env.${safeName.toUpperCase().replace(/-/g, '_')}_IMAGE_URI ?? 'placeholder',
//   env: { account: process.env.AWS_ACCOUNT_ID, region: process.env.AWS_REGION },
// });
`;
  writeFileSync(appTs, content + hint);
}

function findProjectRoot(): string {
  const candidates = [
    process.cwd(),
    join(process.cwd(), '..'),
    join(process.cwd(), '../..'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'turbo.json'))) return dir;
  }
  return process.cwd();
}

function toPascalCase(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function toCamelCase(s: string): string {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
