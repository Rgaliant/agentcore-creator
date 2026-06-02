import type { ChannelType } from './agent.js';

/** Parameters for the generic /api/workflows/start endpoint */
export interface WorkflowStartParams {
  agentId: string;
  message: string;
  channel: ChannelType;
  metadata?: Record<string, string>;
}

/** Response from /api/workflows/start */
export interface WorkflowStartResult {
  runId: string;
  agentRunId: string; // DynamoDB AgentRun ID
}

/** Parameters for resuming a workflow hook */
export interface WorkflowResumeParams {
  token: string;
  payload: Record<string, unknown>;
}

/** Standard workflow output chunk — written inside "use step" functions via getWritable() */
export interface AgentOutputChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
}
