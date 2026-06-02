import { getWritable } from 'workflow';
import { DurableAgent } from '@workflow/ai/agent';
import { stepCountIs } from 'ai';
import { z } from 'zod';
import type { PullRequestEvent, PRReview } from '@agentcore/shared';
import {
  fetchPRDiff,
  postGitHubReview,
  storeRunRecord,
  updateRunRecord,
  parseReviewFromText,
} from './steps.js';
import { CODE_REVIEW_SYSTEM_PROMPT, buildReviewPrompt } from './prompts.js';
import type { UIMessageChunk } from 'ai';

/**
 * Durable workflow for reviewing a GitHub pull request.
 *
 * Flow:
 * 1. Create a run record in DynamoDB (step)
 * 2. Fetch the PR diff from GitHub (step)
 * 3. Run DurableAgent to produce structured review (step)
 * 4. Post review to GitHub PR (step)
 * 5. Update run record as completed (step)
 */
export async function codeReviewWorkflow(event: PullRequestEvent): Promise<PRReview> {
  'use workflow';

  console.log('[workflow] codeReviewWorkflow start', {
    repo: event.repository.full_name,
    pr: event.pull_request.number,
    action: event.action,
  });

  const repo = event.repository.full_name;
  const prNumber = event.pull_request.number;

  // Step 1: Create run record
  const runId = await storeRunRecord({
    agentId: 'code-review',
    status: 'running',
    channel: 'github',
    inputSummary: `PR #${prNumber}: ${event.pull_request.title}`,
  });

  console.log('[workflow] run record created', { runId });

  try {
    // Step 2: Fetch PR diff
    const diff = await fetchPRDiff({
      repo,
      prNumber,
      installationId: event.installation?.id,
    });

    console.log('[workflow] diff fetched', { chars: diff.length });

    // Step 3: DurableAgent produces structured review
    // Model routes through Vercel AI Gateway. Run `vercel env pull` to provision
    // VERCEL_OIDC_TOKEN — the preferred auth method (auto-refreshes on Vercel deployments).
    const agent = new DurableAgent({
      model: 'anthropic/claude-sonnet-4.6',
      system: CODE_REVIEW_SYSTEM_PROMPT,
      tools: {
        searchFile: {
          description: 'Search for additional context in the repository',
          inputSchema: z.object({
            repo: z.string(),
            query: z.string(),
            path: z.string().optional(),
          }),
          execute: searchFileStep,
        },
      },
    });

    const result = await agent.stream({
      messages: [
        {
          role: 'user',
          content: buildReviewPrompt(
            diff,
            event.pull_request.title,
            event.pull_request.body ?? ''
          ),
        },
      ],
      writable: getWritable<UIMessageChunk>({ namespace: 'agent:output' }),
      stopWhen: stepCountIs(5),
    });

    console.log('[workflow] agent stream complete');

    // Extract the final text response
    const finalText =
      result.messages
        .filter((m) => m.role === 'assistant')
        .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
        .join('\n') ?? '';

    const review = parseReviewFromText(finalText, repo, prNumber);

    console.log('[workflow] review parsed', {
      verdict: review.verdict,
      lineComments: review.lineComments.length,
    });

    // Step 4: Post review to GitHub
    await postGitHubReview({
      repo,
      prNumber,
      review,
      installationId: event.installation?.id,
    });

    // Step 5: Mark run as completed
    await updateRunRecord('code-review', runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      outputSummary: review.summary.slice(0, 500),
    });

    console.log('[workflow] codeReviewWorkflow complete', { runId });
    return review;
  } catch (error) {
    console.error('[workflow] codeReviewWorkflow failed', { runId, error });
    await updateRunRecord('code-review', runId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Tool step: search a file in the GitHub repo for additional context
async function searchFileStep(params: { repo: string; query: string; path?: string }) {
  'use step';

  console.log('[step] searchFile start', params);

  const { getGitHubClient } = await import('../utils/github-client.js');
  const octokit = getGitHubClient();
  const [owner, repoName] = params.repo.split('/');

  if (!owner || !repoName) return { results: [] };

  const { data } = await octokit.rest.search.code({
    q: `${params.query} repo:${params.repo}${params.path ? ` path:${params.path}` : ''}`,
  });

  const results = data.items.slice(0, 3).map((item) => ({
    path: item.path,
    url: item.html_url,
  }));

  console.log('[step] searchFile done', { count: results.length });
  return { results };
}
