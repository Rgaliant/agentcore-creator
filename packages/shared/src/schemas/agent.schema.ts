import { z } from 'zod';

export const AgentStatusSchema = z.enum(['active', 'inactive', 'error', 'deploying']);

export const AgentTypeSchema = z.enum(['code-review', 'codebase-qa', 'custom']);

export const ChannelTypeSchema = z.enum(['discord', 'email', 'web']);

export const AgentConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  description: z.string().max(512).default(''),
  type: AgentTypeSchema,
  status: AgentStatusSchema.default('inactive'),
  modelId: z.string().min(1),
  systemPrompt: z.string().max(4096).optional(),
  agentCoreRuntimeArn: z.string().optional(),
  agentCoreMemoryId: z.string().optional(),
  agentCoreGatewayUrl: z.string().url().optional(),
  channels: z.array(ChannelTypeSchema).min(1),
  githubRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateAgentSchema = AgentConfigSchema.omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  agentCoreRuntimeArn: true,
  agentCoreMemoryId: true,
  agentCoreGatewayUrl: true,
});

export const UpdateAgentSchema = CreateAgentSchema.partial();

export const WorkflowStartSchema = z.object({
  agentId: z.string().min(1),
  message: z.string().min(1).max(4096),
  channel: ChannelTypeSchema.default('web'),
  metadata: z.record(z.string()).optional(),
});
