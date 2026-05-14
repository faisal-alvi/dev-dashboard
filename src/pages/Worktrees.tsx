import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWorktreeData, summariseGit, type Worktree } from '../lib/worktrees';
import { linearUrl, worktreePath } from '../lib/constants';
import { hasToken } from '../lib/tokens';
import CopyButton from '../components/CopyButton';
import DraftPRModal from '../components/DraftPRModal';

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

function ActionButton({
  href,
  label,
  title,
}: {
  href: string;
  label: string;
  title?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="text-xs px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
    >
      {label} ↗
    </a>
  );
}

function WorktreeCard({ wt, plugin }: { wt: Worktree; plugin: string }) {
  const [draftPROpen, setDraftPROpen] = useState(false);
  const githubReady = hasToken('github');
  const gitSummary = summariseGit(wt.git);
  const aheadBehind =
    wt.git.ahead === 0 && wt.git.behind === 0
      ? null
      : `↑${wt.git.ahead} ↓${wt.git.behind}`;
  const path = worktreePath(plugin, wt.ticket);
  const canDraftPR = githubReady && Boolean(wt.github_repo) && !wt.pr_url && wt.git.ahead > 0;

  return (
    <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-mono text-sm font-semibold">{wt.ticket}</span>
            {wt.status && (
              <span
                className={`px-1.5 py-0.5 text-xs rounded ${statusBadgeClass(wt.status)}`}
              >
                {wt.status}
              </span>
            )}
            {wt.review_status && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Review: {wt.review_status}
              </span>
            )}
          </div>
          {wt.title && (
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
              {wt.title}
            </p>
          )}
          {wt.next_action && (
            <p className="text-xs text-slate-500 mt-1.5">
              <span className="font-medium">Next:</span> {wt.next_action}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right text-xs text-slate-500 font-mono">
          <div className={gitSummary === 'clean' ? 'text-slate-400' : ''}>
            {gitSummary}
          </div>
          {aheadBehind && <div className="mt-0.5">{aheadBehind}</div>}
          <div className="mt-1">{relativeDay(wt.last_activity)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {wt.pr_url && <ActionButton href={wt.pr_url} label="PR" title="Open PR on GitHub" />}
        <ActionButton
          href={linearUrl(wt.ticket)}
          label="Linear"
          title="Open ticket on Linear"
        />
        {wt.github_repo && (
          <ActionButton
            href={`https://github.com/${wt.github_repo}/tree/${wt.branch}`}
            label="Branch"
            title="View branch on GitHub"
          />
        )}
        <CopyButton value={`cd ${path}`} label="cd path" />
        <CopyButton value={`/cleanup-ticket ${wt.ticket}`} label="cleanup cmd" />
        {canDraftPR && (
          <button
            onClick={() => setDraftPROpen(true)}
            title="Draft a PR — you'll see the description and approve before it's created"
            className="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
          >
            ✏️ Draft PR
          </button>
        )}
      </div>
      {canDraftPR && wt.github_repo && (
        <DraftPRModal
          open={draftPROpen}
          onClose={() => setDraftPROpen(false)}
          ticket={wt.ticket}
          ticketTitle={wt.title}
          repo={wt.github_repo}
          branch={wt.branch}
        />
      )}
    </div>
  );
}

function PluginCount({ count, label }: { count: number; label: string }) {
  return (
    <span className="text-xs text-slate-500">
      <span className="font-medium text-slate-700 dark:text-slate-300">{count}</span> {label}
    </span>
  );
}

export default function Worktrees() {
  const query = useQuery({
    queryKey: ['worktree-data'],
    queryFn: fetchWorktreeData,
    staleTime: 30 * 1000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="text-sm text-red-600">
        Error: {(query.error as Error).message}
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

  const totalWorktrees = data.plugins.reduce((sum, p) => sum + p.worktrees.length, 0);
  const generated = new Date(data.generated_at);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Worktrees</h2>
          <p className="text-xs text-slate-500 mt-1">
            <PluginCount count={totalWorktrees} label="worktrees" /> ·{' '}
            <PluginCount count={data.plugins.length} label="plugins" /> · synced{' '}
            {relativeDay(data.generated_at)} ({generated.toLocaleString()})
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {data.plugins.map((plugin) => (
          <section key={plugin.name}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 sticky top-0 bg-slate-50 dark:bg-slate-950 py-1">
              {plugin.name}{' '}
              <span className="text-xs font-normal text-slate-500">
                ({plugin.worktrees.length})
              </span>
            </h3>
            <div className="space-y-3">
              {plugin.worktrees.map((wt) => (
                <WorktreeCard key={wt.ticket} wt={wt} plugin={plugin.name} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
