import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AgentRuntime } from '../constructs/agent-runtime.js';
import { AgentGateway } from '../constructs/agent-gateway.js';
import { AgentMemory } from '../constructs/agent-memory.js';

export interface AgentCoreStackProps extends cdk.StackProps {
  agentName: string;
  /** ECR image URI for the agent container */
  imageUri: string;
  /** Enable AgentCore Memory for this agent (enables RAG). Default: false */
  enableMemory?: boolean;
  /** Enable AgentCore Gateway for tool access. Default: false */
  enableGateway?: boolean;
  /** Lambda ARNs to expose as MCP tools via the Gateway */
  toolLambdaArns?: string[];
  /** Memory expiry in days. Default: 90 */
  memoryExpiryDays?: number;
}

/**
 * Top-level stack for a single AgentCore agent.
 * Composes Runtime + optional Gateway + optional Memory constructs.
 * Deploy independently per agent: cdk deploy AgentCoreStack-<agentName>
 */
export class AgentCoreStack extends cdk.Stack {
  public readonly runtimeArn: string;
  public readonly gatewayUrl?: string;
  public readonly memoryId?: string;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    const {
      agentName,
      imageUri,
      enableMemory = false,
      enableGateway = false,
      toolLambdaArns = [],
      memoryExpiryDays = 90,
    } = props;

    console.log(`[AgentCoreStack] Synthesizing stack for agent: ${agentName}`);
    console.log(`[AgentCoreStack] Gateway: ${enableGateway}, Memory: ${enableMemory}`);

    const runtime = new AgentRuntime(this, 'Runtime', { agentName, imageUri });
    this.runtimeArn = runtime.runtimeArn;

    if (enableGateway) {
      const gateway = new AgentGateway(this, 'Gateway', { agentName, toolLambdaArns });
      this.gatewayUrl = gateway.gatewayUrl;
    }

    if (enableMemory) {
      const memory = new AgentMemory(this, 'Memory', { agentName, eventExpiryDays: memoryExpiryDays });
      this.memoryId = memory.memoryId;
    }

    cdk.Tags.of(this).add('agentcore:agent', agentName);
    cdk.Tags.of(this).add('agentcore:managed', 'true');
  }
}
