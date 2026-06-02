import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import pc from 'picocolors';

export async function createCommand(
  name: string,
  opts: { install: boolean; git: boolean }
): Promise<void> {
  const targetDir = resolve(process.cwd(), name);

  console.log(`\n${pc.bold('AgentCore Creator')} — scaffolding ${pc.cyan(name)}\n`);

  if (existsSync(targetDir)) {
    console.error(pc.red(`✗ Directory "${name}" already exists.`));
    process.exit(1);
  }

  // 1. Copy the monorepo template
  const templateDir = join(__dirname, '../../templates/monorepo');
  if (!existsSync(templateDir)) {
    console.error(pc.red('✗ Template not found. Is create-agentcore installed correctly?'));
    process.exit(1);
  }

  console.log(pc.gray('  Copying template files…'));
  mkdirSync(targetDir, { recursive: true });
  cpSync(templateDir, targetDir, { recursive: true });

  // 2. Rename placeholders in key files
  const filesToPatch = [
    'package.json',
    'README.md',
    'apps/web/package.json',
  ];

  for (const file of filesToPatch) {
    const filePath = join(targetDir, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8').replaceAll('{{PROJECT_NAME}}', name);
      writeFileSync(filePath, content);
    }
  }

  console.log(pc.green('  ✓ Files copied'));

  // 3. pnpm install
  if (opts.install) {
    console.log(pc.gray('\n  Installing dependencies…'));
    try {
      execSync('pnpm install', { cwd: targetDir, stdio: 'inherit' });
      console.log(pc.green('  ✓ Dependencies installed'));
    } catch {
      console.warn(pc.yellow('  ⚠ pnpm install failed — run it manually'));
    }
  }

  // 4. Git init
  if (opts.git) {
    console.log(pc.gray('\n  Initialising git repository…'));
    try {
      execSync('git init && git add -A && git commit -m "chore: initial scaffold from create-agentcore"', {
        cwd: targetDir,
        stdio: 'pipe',
      });
      console.log(pc.green('  ✓ Git repository initialised'));
    } catch {
      console.warn(pc.yellow('  ⚠ Git init failed — run it manually'));
    }
  }

  // 5. Print next steps
  console.log(`
${pc.bold('Done!')} Your AgentCore platform is ready at ${pc.cyan(name)}/

${pc.bold('Next steps:')}

  ${pc.cyan(`cd ${name}`)}

  1. Fill in your credentials:
     ${pc.gray('cp .env.example .env.local')}
     ${pc.gray('# Edit .env.local with AWS, Discord, GitHub, SES values')}

  2. Run ${pc.cyan('vercel env pull .env.local')} to provision VERCEL_OIDC_TOKEN

  3. Bootstrap AWS (first time only):
     ${pc.cyan('cd packages/infra && npx cdk bootstrap')}

  4. Deploy infrastructure:
     ${pc.cyan('pnpm agentcore deploy')}

  5. Start the dev server:
     ${pc.cyan('pnpm dev')}

  ${pc.bold('Docs:')} https://github.com/agentcore-creator/agentcore-creator
`);
}
