export type PullRequestAction = 'opened' | 'synchronize' | 'reopened' | 'closed';

export interface PullRequestEvent {
  action: PullRequestAction;
  number: number;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    diff_url: string;
    patch_url: string;
    state: 'open' | 'closed';
    draft: boolean;
    head: { sha: string; ref: string; label: string };
    base: { sha: string; ref: string; label: string };
    user: { login: string; id: number };
    additions: number;
    deletions: number;
    changed_files: number;
  };
  repository: {
    id: number;
    full_name: string;
    clone_url: string;
    default_branch: string;
    private: boolean;
  };
  sender: { login: string; id: number };
  installation?: { id: number };
}

/** Structured output from the code review agent */
export interface PRReview {
  prNumber: number;
  repo: string;
  /** High-level summary comment posted to the PR */
  summary: string;
  /** Inline line-level comments */
  lineComments: PRLineComment[];
  /** Overall verdict */
  verdict: 'approve' | 'request_changes' | 'comment';
}

export interface PRLineComment {
  path: string;
  /** Line number in the diff (1-indexed) */
  line: number;
  body: string;
  /** 'RIGHT' = new file, 'LEFT' = old file */
  side?: 'LEFT' | 'RIGHT';
}
