import { useQuery } from '@tanstack/react-query';
import { fetchWorktreeData, summariseGit, type Worktree } from '../lib/worktrees';

function relativeDay(isoDate: string | null): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return isoDate;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function statusBadgeClass(status: string | null): string {
  if (!status) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  const s = status.toLowerCase();
  if (s.includes('pending commit') || s.includes('approved'))
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (s.includes('pr raised') || s.includes('pr open'))
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (s.includes('review') || s.includes('pending'))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  if (s.includes('progress'))
    return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
}

function WorktreeRow({ wt }: { wt: Worktree }) {
  const gitSummary = summariseGit(wt.git);
  const aheadBehind =
    wt.git.ahead === 0 && wt.git.behind === 0
      ? '—'
      : `↑${wt.git.ahead} ↓${wt.git.behind}`;
  return (
    <tr className="border-t border-slate-200 dark:border-slate-800">
      <td className="py-2.5 pr-3">
        <div className="font-mono text-xs">{wt.ticket}</div>
        {wt.title && (
          <div className="text-xs text-slate-500 truncate max-w-md mt-0.5">
            {wt.title}
          </div>
        )}
      </td>
      <td className="py-2.5 pr-3">
        <span
          className={`inline-block px-2 py-0.5 text-xs rounded ${statusBadgeClass(
            wt.status,
          )}`}
        >
          {wt.status ?? 'unknown'}
        </span>
      </td>
      <td className="py-2.5 pr-3 font-mono text-xs">
        <span className={gitSummary === 'clean' ? 'text-slate-400' : ''}>
          {gitSummary}
        </span>
      </td>
      <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">
        {aheadBehind}
      </td>
      <td className="py-2.5 pr-3 text-xs text-slate-500">
        {relativeDay(wt.last_activity)}
      </td>
      <td className="py-2.5 text-xs">
        {wt.pr_url && (
          <a
            href={wt.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            PR ↗
          </a>
        )}
      </td>
    </tr>
  );
}

export default function Worktrees() {
  const query = useQuery({
    queryKey: ['worktree-data'],
    queryFn: fetchWorktreeData,
    staleTime: 30 * 1000,
  });

  if (query.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (query.isError) {
    return (
      <p className="text-sm text-red-600">
        Error loading data: {(query.error as Error).message}
      </p>
    );
  }

  const data = query.data;

  if (!data) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-2">Worktrees</h2>
        <p className="text-sm text-slate-500">
          No worktree data has been synced yet. Run{' '}
          <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
            /sync-dashboard
          </code>{' '}
          locally to populate this view.
        </p>
      </div>
    );
  }

  const generated = new Date(data.generated_at);
  const totalWorktrees = data.plugins.reduce(
    (sum, p) => sum + p.worktrees.length,
    0,
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-xl font-semibold">Worktrees</h2>
        <p className="text-xs text-slate-500">
          {totalWorktrees} across {data.plugins.length} plugins · synced{' '}
          {relativeDay(data.generated_at)} ({generated.toLocaleString()})
        </p>
      </div>

      <div className="space-y-8">
        {data.plugins.map((plugin) => (
          <section key={plugin.name}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {plugin.name}
            </h3>
            <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-900/50">
                    <th className="py-2 px-3">Ticket</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Git</th>
                    <th className="py-2 px-3">↑ / ↓</th>
                    <th className="py-2 px-3">Last activity</th>
                    <th className="py-2 px-3">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {plugin.worktrees.map((wt) => (
                    <WorktreeRow key={wt.ticket} wt={wt} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
