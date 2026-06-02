#!/usr/bin/env node
import { program } from 'commander';
import { deployCommand } from './commands/deploy.js';
import { agentAddCommand } from './commands/agent-add.js';
import { logsCommand } from './commands/logs.js';

program
  .name('agentcore')
  .description('Manage your AgentCore AI agent platform')
  .version('0.1.0');

program.addCommand(deployCommand);
program.addCommand(agentAddCommand);
program.addCommand(logsCommand);

program.parse();
