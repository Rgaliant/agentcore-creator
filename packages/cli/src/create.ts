#!/usr/bin/env node
import { Command } from 'commander';
import { createCommand } from './commands/create.js';

const program = new Command();
program
  .name('create-agentcore')
  .description('Scaffold a new AgentCore agent platform')
  .argument('<project-name>', 'Name of the project directory to create')
  .option('--no-install', 'Skip pnpm install')
  .option('--no-git', 'Skip git init')
  .action(async (name: string, opts: { install: boolean; git: boolean }) => {
    await createCommand(name, opts);
  });

program.parse();
