import { getToken } from './tokens';

const API_BASE = 'https://api.github.com';

class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function gh<T>(path: string): Promise<T> {
  const token = getToken('github');
  if (!token) {
    throw new GitHubError('GitHub token not configured', 401);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new GitHubError(
      `GitHub ${res.status} on ${path}`,
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
