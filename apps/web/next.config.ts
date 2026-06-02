import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  // Transpile workspace packages
  transpilePackages: ['@agentcore/shared', '@agentcore/agents'],
  experimental: {
    // Enable React 19 features
    reactCompiler: false,
  },
};

export default withWorkflow(nextConfig);
