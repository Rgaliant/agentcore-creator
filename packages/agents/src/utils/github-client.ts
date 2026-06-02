import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

/** Returns an authenticated Octokit client.
 *  Uses GitHub App auth when GITHUB_APP_ID is set, otherwise falls back to a PAT. */
export function getGitHubClient(installationId?: number): Octokit {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (appId && privateKey && installationId) {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId,
      },
    });
  }

  // Fallback: personal access token
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('No GitHub credentials configured. Set GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY or GITHUB_TOKEN.');
  }

  return new Octokit({ auth: token });
}
