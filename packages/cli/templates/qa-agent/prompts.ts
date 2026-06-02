// {{AGENT_NAME}} — prompt templates

export const SYSTEM_PROMPT = `You are {{AGENT_NAME}}, a codebase Q&A assistant.

You help developers understand the codebase by answering questions based on the code context provided.
Be specific — reference file paths, function names, and line-level details where relevant.
If the context doesn't contain enough information, say so clearly rather than guessing.`;

export function buildQAPrompt(question: string, context: string): string {
  if (!context) {
    return `Answer this question about the codebase: ${question}\n\n(No code context was retrieved — answer from general knowledge if possible.)`;
  }

  return `Answer this question about the codebase using the retrieved code context below.

Question: ${question}

Retrieved context:
<context>
${context}
</context>

Provide a clear, specific answer referencing the relevant parts of the code.`;
}
