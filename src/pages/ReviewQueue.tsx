import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCurrentUser, getReviewRequests, type PullRequest } from '../lib/github';
import { hasToken } from '../lib/tokens';
import AddReviewModal from '../components/AddReviewModal';

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ageColor(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'text-emerald-600 dark:text-emerald-400';
  if (days < 3) return 'text-slate-500';
  if (days < 7) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function repoFromUrl(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\/pull/);
  return match ? match[1] : '';
}

function PRCard({ pr, onDraftReview }: { pr: PullRequest; onDraftReview: () => void }) {
  const repo = repoFromUrl(pr.html_url);
  return (
    <li className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {pr.draft && (
                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  DRAFT
                </span>
              )}
              {pr.labels?.slice(0, 3).map((label) => (
                <span
                  key={label.name}
                  className="px-1.5 py-0.5 text-xs rounded"
                  style={{
                    backgroundColor: `#${label.color}33`,
                    color: `#${label.color}`,
                  }}
                >
                  {label.name}
                </span>
              ))}
              <span className="text-sm font-medium truncate">{pr.title}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span className="font-mono">{repo}</span>
              <span>·</span>
              <span>#{pr.number}</span>
              <span>·</span>
              <span className={ageColor(pr.created_at)}>
                opened {relativeTime(pr.created_at)}
              </span>
              <span>·</span>
              <span>by {pr.user.login}</span>
            </div>
          </a>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <img
            src={pr.user.avatar_url}
            alt={pr.user.login}
            className="w-7 h-7 rounded-full"
          />
          <button
            onClick={onDraftReview}
            className="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors whitespace-nowrap"
          >
            ✏️ Add review
          </button>
        </div>
      </div>
    </li>
  );
}

export default function ReviewQueue() {
  const tokenSet = hasToken('github');
  const [reviewing, setReviewing] = useState<PullRequest | null>(null);

  const user = useQuery({
    queryKey: ['github-user'],
    queryFn: getCurrentUser,
    enabled: tokenSet,
  });

  const prs = useQuery({
    queryKey: ['review-queue', user.data?.login],
    queryFn: () => getReviewRequests(user.data!.login),
    enabled: tokenSet && Boolean(user.data?.login),
  });

  if (!tokenSet) {
    return (
      <div className="text-sm text-slate-500">
        Add your GitHub token in{' '}
        <Link to="/settings" className="underline">
          Settings
        </Link>{' '}
        to see your review queue.
      </div>
    );
  }

  if (prs.isLoading || user.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (prs.isError || user.isError) {
    return (
      <p className="text-sm text-rose-600">
        Error: {(prs.error || user.error)?.message}
      </p>
    );
  }

  const sorted = [...(prs.data ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Review Queue</h2>
        <p className="text-sm text-slate-500 mt-1">
          PRs waiting for your review, oldest first. Use "Add review" to draft a
          pending review — nothing is published until you submit it on GitHub.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center text-sm text-slate-500">
          No PRs waiting on your review. 🎉
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((pr) => (
            <PRCard key={pr.id} pr={pr} onDraftReview={() => setReviewing(pr)} />
          ))}
        </ul>
      )}

      {reviewing && (
        <AddReviewModal
          open={Boolean(reviewing)}
          onClose={() => setReviewing(null)}
          repo={repoFromUrl(reviewing.html_url)}
          prNumber={reviewing.number}
          prTitle={reviewing.title}
        />
      )}
    </div>
  );
}
