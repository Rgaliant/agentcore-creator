export type AgentStatus = 'active' | 'inactive' | 'error' | 'deploying';

export type AgentType = 'code-review' | 'codebase-qa' | 'custom';

export type ChannelType = 'discord' | 'email' | 'web';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  status: AgentStatus;
  modelId: string;
  systemPrompt?: string;
  // AWS AgentCore resource references (populated after CDK deploy)
  agentCoreRuntimeArn?: string;
  agentCoreMemoryId?: string;
  agentCoreGatewayUrl?: string;
  // Channel configuration
  channels: ChannelType[];
  // GitHub integration (for code-review and codebase-qa agents)
  githubRepo?: string;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  runId: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  channel: ChannelType | 'github';
  startedAt: string;
  completedAt?: string;
  inputSummary: string;
  outputSummary?: string;
  workflowRunId?: string; // Vercel Workflow run ID for WDK-backed runs
  errorMessage?: string;
}

export interface ConversationThread {
  threadId: string; // e.g. "discord-{channelId}-{userId}"
  agentId: string;
  channel: ChannelType;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
