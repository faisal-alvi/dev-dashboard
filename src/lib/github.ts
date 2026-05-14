import { getToken } from './tokens';

const API_BASE = 'https://api.github.com';

class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function gh<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken('github');
  if (!token) {
    throw new GitHubError('GitHub token not configured', 401);
  }
  const method = options.method ?? 'GET';
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      if (body?.message) detail = `: ${body.message}`;
      if (body?.errors?.length) {
        detail += ` (${body.errors.map((e: { message?: string; field?: string }) => e.message || e.field).join(', ')})`;
      }
    } catch {
      // ignore
    }
    throw new GitHubError(
      `GitHub ${res.status} on ${method} ${path}${detail}`,
      res.status,
    );
  }
  return res.json();
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  head: { ref: string; repo: { full_name: string } | null };
  base: { ref: string };
  requested_reviewers: { login: string }[];
  labels: { name: string; color: string }[];
}

export async function getCurrentUser(): Promise<GitHubUser> {
  return gh<GitHubUser>('/user');
}

export async function getMyOpenPRs(username: string): Promise<PullRequest[]> {
  const q = encodeURIComponent(`is:pr is:open author:${username}`);
  const data = await gh<{ items: PullRequest[] }>(
    `/search/issues?q=${q}&per_page=50`,
  );
  return data.items;
}

export async function getReviewRequests(username: string): Promise<PullRequest[]> {
  const q = encodeURIComponent(`is:pr is:open review-requested:${username}`);
  const data = await gh<{ items: PullRequest[] }>(
    `/search/issues?q=${q}&per_page=50`,
  );
  return data.items;
}

/**
 * Fetch the PR template (if any) for a repo.
 * Tries `.github/pull_request_template.md` then `docs/pull_request_template.md`.
 * Returns null if neither exists.
 */
export async function getPRTemplate(repo: string): Promise<string | null> {
  const paths = [
    '.github/pull_request_template.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    'docs/pull_request_template.md',
    'PULL_REQUEST_TEMPLATE.md',
  ];
  for (const path of paths) {
    try {
      const data = await gh<{ content: string; encoding: string }>(
        `/repos/${repo}/contents/${path}`,
      );
      if (data.encoding === 'base64') {
        return atob(data.content.replace(/\n/g, ''));
      }
      return data.content;
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) continue;
      throw e;
    }
  }
  return null;
}

/**
 * Create a DRAFT pull request. The `draft: true` flag is hardcoded — this
 * function never creates a non-draft PR. Callers must not be able to override
 * it.
 */
export async function createDraftPR(params: {
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}): Promise<{ html_url: string; number: number }> {
  // SAFETY: draft is hardcoded true. Never accept it as a parameter.
  const data = await gh<{ html_url: string; number: number }>(
    `/repos/${params.repo}/pulls`,
    {
      method: 'POST',
      body: {
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
        draft: true,
      },
    },
  );
  return data;
}

/**
 * Create a PENDING (draft) review on a pull request.
 *
 * The GitHub API treats a review as pending/draft when the `event` field is
 * omitted. This function never accepts an `event` parameter — preventing
 * accidental publishes. The user must submit the review from GitHub's UI.
 */
export async function createPendingReview(params: {
  repo: string;
  pull_number: number;
  body: string;
}): Promise<{ id: number; html_url: string }> {
  // SAFETY: no event field — never publishes. User submits from GitHub UI.
  const data = await gh<{ id: number; html_url: string }>(
    `/repos/${params.repo}/pulls/${params.pull_number}/reviews`,
    {
      method: 'POST',
      body: {
        body: params.body,
      },
    },
  );
  return data;
}
