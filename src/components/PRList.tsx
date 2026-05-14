import type { PullRequest } from '../lib/github';

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function repoFromUrl(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\/pull/);
  return match ? match[1] : '';
}

export default function PRList({
  prs,
  emptyMessage,
}: {
  prs: PullRequest[];
  emptyMessage: string;
}) {
  if (prs.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center">{emptyMessage}</p>
    );
  }
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
      {prs.map((pr) => (
        <li key={pr.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900">
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {pr.draft && (
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      DRAFT
                    </span>
                  )}
                  <span className="text-sm font-medium truncate">
                    {pr.title}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span>{repoFromUrl(pr.html_url)}</span>
                  <span>·</span>
                  <span>#{pr.number}</span>
                  <span>·</span>
                  <span>updated {relativeTime(pr.updated_at)}</span>
                </div>
              </div>
              <img
                src={pr.user.avatar_url}
                alt={pr.user.login}
                className="w-7 h-7 rounded-full flex-shrink-0"
              />
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
