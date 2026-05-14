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

function ageColor(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'text-emerald-600 dark:text-emerald-400';
  if (days < 3) return 'text-slate-500';
  if (days < 7) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
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
      <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {prs.map((pr) => (
        <li
          key={pr.id}
          className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all"
        >
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
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
                  <span className="font-mono">{repoFromUrl(pr.html_url)}</span>
                  <span>·</span>
                  <span>#{pr.number}</span>
                  <span>·</span>
                  <span className={ageColor(pr.updated_at)}>
                    updated {relativeTime(pr.updated_at)}
                  </span>
                  {pr.head?.ref && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{pr.head.ref}</span>
                    </>
                  )}
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
