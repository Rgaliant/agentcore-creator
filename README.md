# agentcore-creator

> Turnkey toolkit for spinning up AWS AgentCore gateways with background AI agents — accessible from Discord, email, or a web UI.

## What it does

- **One command bootstrap**: `npx create-agentcore my-agents` scaffolds a full production-ready agent platform
- **AWS AgentCore** (Amazon Bedrock): Runtime, Gateway (MCP), and Memory — all provisioned via AWS CDK
- **Durable workflows**: Agents survive restarts, handle multi-turn conversations, and run for hours using [Vercel Workflow DevKit](https://useworkflow.dev)
- **Multi-channel**: Chat with your agents via Discord, email, or the built-in web UI
- **Pre-built agents**: Code review (GitHub PRs) and Codebase Q&A (RAG over your repo) ready to deploy
- **Visual workflow builder**: Build and deploy custom agent workflows from a drag-and-drop UI

## Repo structure

```
agentcore-creator/
├── packages/
│   ├── shared/     # @agentcore/shared — TypeScript types + Zod schemas
│   ├── infra/      # @agentcore/infra  — AWS CDK v2 stacks
│   ├── agents/     # @agentcore/agents — Agent workflows (WDK)
│   └── cli/        # create-agentcore + agentcore CLI
└── apps/
    └── web/        # Next.js 15 web UI (hosted on Vercel)
```

## Quick start

### Prerequisites

- Node.js ≥ 20, pnpm ≥ 9
- AWS CLI configured (`aws configure`)
- AWS CDK bootstrapped (`cdk bootstrap`)
- A Vercel account (for the web UI)

### 1. Scaffold a new project

```bash
npx create-agentcore my-agents
cd my-agents
```

### 2. Fill in your environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your AWS, Discord, GitHub, and SES credentials
```

### 3. Deploy AWS infrastructure

```bash
pnpm agentcore deploy
# Deploys CDK stacks and syncs outputs to .env.local
```

### 4. Start the web UI locally

```bash
pnpm dev
# Open http://localhost:3000
```

### 5. Deploy the web UI to Vercel

```bash
vercel deploy
```

## Built-in agents

| Agent | Trigger | Description |
|---|---|---|
| **Code Review** | GitHub PR webhook | Reviews PRs and posts inline comments via GitHub API |
| **Codebase Q&A** | Discord / Web chat | Answers questions about your codebase using RAG |

## Adding custom agents

```bash
pnpm agentcore agent add code-review    # scaffold from template
pnpm agentcore agent add codebase-qa
pnpm agentcore agent add custom         # blank template
```

## CLI reference

```bash
npx create-agentcore <name>        # scaffold new project
agentcore deploy [stack]           # deploy CDK stacks
agentcore agent add <template>     # add a new agent
agentcore logs <agentId>           # tail agent run logs
```

## Architecture

```
Discord / Email / Web UI
        │
        ▼
  Next.js API routes  ──────────────────────────────────────┐
        │                                                     │
        ▼                                                     ▼
 Vercel Workflow DevKit                              AWS AgentCore
 (durable agent runs)                          ┌──── Runtime (MCP)
        │                                      ├──── Gateway (tools)
        │    ──── AWS Bedrock models ──────────└──── Memory (RAG)
        │
        ▼
 DynamoDB (agent state) + SQS (async messaging)
```

## License

MIT
