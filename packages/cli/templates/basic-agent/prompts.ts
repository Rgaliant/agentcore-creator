// {{AGENT_NAME}} — prompt templates

export const SYSTEM_PROMPT = `You are a helpful AI assistant named {{AGENT_NAME}}.

Be concise, accurate, and friendly.`;

export function buildUserPrompt(input: string): string {
  return input;
}
