import { getGitHubClient } from '../utils/github-client.js';
import { createAgentRun, updateAgentRun } from '../utils/dynamodb-client.js';
import type { AgentRun, PullRequestEvent, PRReview } from '@agentcore/shared';

/**
 * Fetches the unified diff for a pull request from GitHub.
 * Returns the raw diff string (may be truncated for very large PRs).
 */
export async function fetchPRDiff(params: {
  repo: string;
  prNumber: number;
  installationId?: number;
}): Promise<string> {
  'use step';

  console.log('[step] fetchPRDiff start', { repo: params.repo, prNumber: params.prNumber });

  const [owner, repoName] = params.repo.split('/');
  if (!owner || !repoName) {
    throw new Error(`Invalid repo format: ${params.repo}. Expected "owner/repo".`);
  }

  const octokit = getGitHubClient(params.installationId);

  const response = await octokit.rest.pulls.get({
    owner,
    repo: repoName,
    pull_number: params.prNumber,
    mediaType: { format: 'diff' },
  });

  const diff = response.data as unknown as string;

  console.log('[step] fetchPRDiff done', {
    repo: params.repo,
    prNumber: params.prNumber,
    chars: diff.length,
  });

  return diff;
}

/**
 * Posts a code review (summary + line comments) to a GitHub PR.
 */
export async function postGitHubReview(params: {
  repo: string;
  prNumber: number;
  review: PRReview;
  installationId?: number;
}): Promise<void> {
  'use step';

  const { repo, prNumber, review, installationId } = params;
  console.log('[step] postGitHubReview start', { repo, prNumber, verdict: review.verdict });

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    throw new Error(`Invalid repo format: ${repo}`);
  }

  const octokit = getGitHubClient(installationId);

  // Map verdict to GitHub review event
  const eventMap: Record<PRReview['verdict'], 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'> = {
    approve: 'APPROVE',
    request_changes: 'REQUEST_CHANGES',
    comment: 'COMMENT',
  };

  await octokit.rest.pulls.createReview({
    owner,
    repo: repoName,
    pull_number: prNumber,
    event: eventMap[review.verdict],
    body: review.summary,
    comments: review.lineComments.map((c) => ({
      path: c.path,
      line: c.line,
      side: c.side ?? 'RIGHT',
      body: c.body,
    })),
  });

  console.log('[step] postGitHubReview done', { repo, prNumber });
}

/**
 * Persists a new AgentRun record to DynamoDB. Returns the generated runId.
 */
export async function storeRunRecord(
  run: Omit<AgentRun, 'runId' | 'startedAt'>
): Promise<string> {
  'use step';

  console.log('[step] storeRunRecord start', { agentId: run.agentId, channel: run.channel });
  const runId = await createAgentRun(run);
  console.log('[step] storeRunRecord done', { runId });
  return runId;
}

/**
 * Updates an existing AgentRun record in DynamoDB.
 */
export async function updateRunRecord(
  agentId: string,
  runId: string,
  update: Partial<Pick<AgentRun, 'status' | 'completedAt' | 'outputSummary' | 'errorMessage'>>
): Promise<void> {
  'use step';

  console.log('[step] updateRunRecord start', { agentId, runId, status: update.status });
  await updateAgentRun(agentId, runId, update);
  console.log('[step] updateRunRecord done', { agentId, runId });
}

/**
 * Parses the structured JSON review from the agent's response messages.
 */
export function parseReviewFromText(text: string, repo: string, prNumber: number): PRReview {
  // Extract JSON from the response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch?.[1] ?? text;

  try {
    const parsed = JSON.parse(jsonStr.trim()) as {
      summary: string;
      verdict: PRReview['verdict'];
      lineComments: PRReview['lineComments'];
    };

    return {
      prNumber,
      repo,
      summary: parsed.summary ?? 'Code review complete.',
      verdict: parsed.verdict ?? 'comment',
      lineComments: parsed.lineComments ?? [],
    };
  } catch {
    // Fallback: return the raw text as summary
    return {
      prNumber,
      repo,
      summary: text.slice(0, 2000),
      verdict: 'comment',
      lineComments: [],
    };
  }
}
