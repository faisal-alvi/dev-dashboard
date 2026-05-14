import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWorktreeData, summariseGit, type Worktree } from '../lib/worktrees';
import {
  getCurrentUser,
  getMyOpenPRs,
  getReviewRequests,
  type PullRequest,
} from '../lib/github';
import { deriveWorktreeState } from '../lib/worktree-state';
import { linearUrl, worktreePath } from '../lib/constants';
import { hasToken } from '../lib/tokens';
import CopyButton from '../components/CopyButton';
import DraftPRModal from '../components/DraftPRModal';
import AddReviewModal from '../components/AddReviewModal';

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

function ActionButton({
  href,
  label,
  title,
  primary = false,
}: {
  href: string;
  label: string;
  title?: string;
  primary?: boolean;
}) {
  const cls = primary
    ? 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40'
    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={`text-xs px-2 py-0.5 rounded border transition-colors inline-flex items-center gap-1 ${cls}`}
    >
      {label} ↗
    </a>
  );
}

function ButtonAction({
  onClick,
  label,
  primary = false,
  title,
}: {
  onClick: () => void;
  label: string;
  primary?: boolean;
  title?: string;
}) {
  const cls = primary
    ? 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40'
    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`text-xs px-2 py-0.5 rounded border transition-colors ${cls}`}
    >
      {label}
    </button>
  );
}

function WorktreeCard({
  wt,
  plugin,
  matchingPR,
}: {
  wt: Worktree;
  plugin: string;
  matchingPR: PullRequest | undefined;
}) {
  const [draftPROpen, setDraftPROpen] = useState(false);
  const [addReviewOpen, setAddReviewOpen] = useState(false);
  const githubReady = hasToken('github');
  const derived = deriveWorktreeState(wt, matchingPR);
  const gitSummary = summariseGit(wt.git);
  const aheadBehind =
    wt.git.ahead === 0 && wt.git.behind === 0
      ? null
      : `↑${wt.git.ahead} ↓${wt.git.behind}`;
  const path = worktreePath(plugin, wt.ticket);

  // PR URL: prefer live data from GitHub API, fall back to status.md
  const prUrl = matchingPR?.html_url ?? wt.pr_url;
  const prNumber = matchingPR?.number;

  // Action visibility based on state
  const showDraftPR =
    githubReady &&
    Boolean(wt.github_repo) &&
    !matchingPR &&
    !wt.pr_url &&
    wt.git.ahead > 0 &&
    derived.state === 'ready_for_pr';

  const showAddReview =
    githubReady &&
    Boolean(wt.github_repo) &&
    derived.state === 'reviewing' &&
    prNumber !== undefined;

  return (
    <div
      className={`border border-slate-200 dark:border-slate-800 border-l-4 ${derived.accentColor} rounded-lg bg-white dark:bg-slate-900/50 hover:shadow-sm transition-all`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${derived.badgeClass}`}
              >
                <span>{derived.icon}</span>
                <span>{derived.label}</span>
              </span>
              <span className="font-mono text-sm font-semibold">{wt.ticket}</span>
              {wt.review_status && derived.state !== 'reviewing' && (
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
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 leading-snug">
              <span className="font-semibold">Next →</span> {derived.nextStep}
            </p>
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
          {prUrl && (
            <ActionButton
              href={prUrl}
              label={
                derived.state === 'pr_draft'
                  ? `PR draft #${prNumber ?? ''}`
                  : derived.state === 'in_review'
                  ? `PR #${prNumber ?? ''}`
                  : 'PR'
              }
              title="Open PR on GitHub"
              primary={derived.state === 'pr_draft' || derived.state === 'in_review'}
            />
          )}
          {showDraftPR && (
            <ButtonAction
              onClick={() => setDraftPROpen(true)}
              label="✏️ Draft PR"
              primary
              title="Preview description, then create a draft PR"
            />
          )}
          {showAddReview && (
            <ButtonAction
              onClick={() => setAddReviewOpen(true)}
              label="✏️ Add review"
              primary
              title="Draft a pending review (not published until you submit on GitHub)"
            />
          )}
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
        </div>
      </div>

      {showDraftPR && wt.github_repo && (
        <DraftPRModal
          open={draftPROpen}
          onClose={() => setDraftPROpen(false)}
          ticket={wt.ticket}
          ticketTitle={wt.title}
          repo={wt.github_repo}
          branch={wt.branch}
        />
      )}
      {showAddReview && wt.github_repo && prNumber !== undefined && (
        <AddReviewModal
          open={addReviewOpen}
          onClose={() => setAddReviewOpen(false)}
          repo={wt.github_repo}
          prNumber={prNumber}
          prTitle={matchingPR?.title ?? wt.title ?? wt.ticket}
        />
      )}
    </div>
  );
}

function StateCount({
  label,
  count,
  icon,
  color,
}: {
  label: string;
  count: number;
  icon: string;
  color: string;
}) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${color}`}>
      <span>{icon}</span>
      <span className="font-medium">{count}</span>
      <span>{label}</span>
    </span>
  );
}

export default function Worktrees() {
  const tokenSet = hasToken('github');

  const worktreesQ = useQuery({
    queryKey: ['worktree-data'],
    queryFn: fetchWorktreeData,
    staleTime: 30 * 1000,
  });

  // Cross-reference with live GitHub PRs to detect existing PRs by branch.
  const ghUser = useQuery({
    queryKey: ['github-user'],
    queryFn: getCurrentUser,
    enabled: tokenSet,
  });

  const myPRsQ = useQuery({
    queryKey: ['my-prs', ghUser.data?.login],
    queryFn: () => getMyOpenPRs(ghUser.data!.login),
    enabled: tokenSet && Boolean(ghUser.data?.login),
  });

  // Also include PRs assigned to you for review — those match the
  // "reviewing" worktrees created by /review-ticket.
  const reviewQ = useQuery({
    queryKey: ['review-queue', ghUser.data?.login],
    queryFn: () => getReviewRequests(ghUser.data!.login),
    enabled: tokenSet && Boolean(ghUser.data?.login),
  });

  if (worktreesQ.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (worktreesQ.isError) {
    return <p className="text-sm text-rose-600">{(worktreesQ.error as Error).message}</p>;
  }

  const data = worktreesQ.data;
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

  // Build a lookup of PRs by `{repo}#{branch}`
  const prIndex = new Map<string, PullRequest>();
  for (const pr of myPRsQ.data ?? []) {
    if (pr.head?.repo?.full_name) {
      prIndex.set(`${pr.head.repo.full_name}#${pr.head.ref}`, pr);
    }
  }
  for (const pr of reviewQ.data ?? []) {
    if (pr.head?.repo?.full_name) {
      prIndex.set(`${pr.head.repo.full_name}#${pr.head.ref}`, pr);
    }
  }

  const allWorktrees = data.plugins.flatMap((p) =>
    p.worktrees.map((wt) => {
      const key = wt.github_repo ? `${wt.github_repo}#${wt.branch}` : '';
      const matchingPR = prIndex.get(key);
      return { plugin: p.name, wt, matchingPR, state: deriveWorktreeState(wt, matchingPR).state };
    }),
  );

  const totalWorktrees = allWorktrees.length;
  const generated = new Date(data.generated_at);

  // State summary counts
  const stateCounts = {
    implementing: allWorktrees.filter((x) => x.state === 'implementing').length,
    ready_for_pr: allWorktrees.filter((x) => x.state === 'ready_for_pr').length,
    pr_draft: allWorktrees.filter((x) => x.state === 'pr_draft').length,
    in_review: allWorktrees.filter((x) => x.state === 'in_review').length,
    reviewing: allWorktrees.filter((x) => x.state === 'reviewing').length,
    merged: allWorktrees.filter((x) => x.state === 'merged').length,
    unknown: allWorktrees.filter((x) => x.state === 'unknown').length,
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold">Worktrees</h2>
          <p className="text-xs text-slate-500 mt-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {totalWorktrees}
            </span>{' '}
            worktrees across{' '}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {data.plugins.length}
            </span>{' '}
            plugins · synced {relativeDay(data.generated_at)} (
            {generated.toLocaleString()})
            {!tokenSet && (
              <span className="ml-2 text-amber-600">
                · GitHub token missing — PR cross-reference disabled
              </span>
            )}
          </p>
        </div>
      </div>

      {/* State summary */}
      <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <StateCount label="implementing" count={stateCounts.implementing} icon="⚒️" color="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" />
        <StateCount label="ready for PR" count={stateCounts.ready_for_pr} icon="✓" color="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" />
        <StateCount label="PR draft" count={stateCounts.pr_draft} icon="📝" color="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300" />
        <StateCount label="in review" count={stateCounts.in_review} icon="👀" color="bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300" />
        <StateCount label="reviewing" count={stateCounts.reviewing} icon="🔍" color="bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300" />
        <StateCount label="merged" count={stateCounts.merged} icon="✅" color="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" />
        <StateCount label="unknown" count={stateCounts.unknown} icon="❓" color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" />
      </div>

      <div className="space-y-8">
        {data.plugins.map((plugin) => (
          <section key={plugin.name}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 sticky top-0 bg-slate-50 dark:bg-slate-950 py-1 z-10">
              {plugin.name}{' '}
              <span className="text-xs font-normal text-slate-500">
                ({plugin.worktrees.length})
              </span>
            </h3>
            <div className="space-y-3">
              {plugin.worktrees.map((wt) => {
                const key = wt.github_repo ? `${wt.github_repo}#${wt.branch}` : '';
                return (
                  <WorktreeCard
                    key={wt.ticket}
                    wt={wt}
                    plugin={plugin.name}
                    matchingPR={prIndex.get(key)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
