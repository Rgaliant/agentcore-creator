import type { PullRequestEvent } from '@agentcore/shared';

// {{AGENT_NAME}} — prompt templates

export const SYSTEM_PROMPT = `You are {{AGENT_NAME}}, an expert code reviewer.

Your reviews should be:
- Concise and actionable
- Focused on correctness, security, and maintainability
- Constructive in tone — suggest improvements, don't just criticize
- Structured with a brief summary followed by specific line-level comments

Format your review as a GitHub Markdown comment.`;

export function buildReviewPrompt(event: PullRequestEvent, diff: string): string {
  return `Review the following pull request:

**Repository:** ${event.repository.full_name}
**PR #${event.pull_request.number}:** ${event.pull_request.title}
**Author:** ${event.pull_request.user.login}

<diff>
${diff.slice(0, 20_000)}
</diff>

Provide a thorough code review. Highlight any bugs, security issues, or improvements.`;
}
