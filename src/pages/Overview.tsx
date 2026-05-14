import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getCurrentUser as getGitHubUser,
  getMyOpenPRs,
  getReviewRequests,
} from '../lib/github';
import {
  getCurrentUser as getTeamworkUser,
  getMyTimeEntries,
  sumHours,
  teamworkDate,
  weekStart,
  weekEnd,
} from '../lib/teamwork';
import { fetchWorktreeData } from '../lib/worktrees';
import { hasToken } from '../lib/tokens';
import { WEEKLY_TARGET_HOURS } from '../lib/constants';

function StatCard({
  label,
  value,
  sublabel,
  to,
  accent,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  to: string;
  accent?: string;
}) {
  return (
    <Link
      to={to}
      className="group block p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-sm transition-all"
    >
      <div className={`text-3xl font-semibold ${accent ?? ''}`}>{value}</div>
      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{label}</div>
      {sublabel && (
        <div className="text-xs text-slate-500 mt-2">{sublabel}</div>
      )}
    </Link>
  );
}

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function Overview() {
  const githubSet = hasToken('github');
  const teamworkSet = hasToken('teamwork');

  const ghUser = useQuery({
    queryKey: ['github-user'],
    queryFn: getGitHubUser,
    enabled: githubSet,
  });
  const myPRs = useQuery({
    queryKey: ['my-prs', ghUser.data?.login],
    queryFn: () => getMyOpenPRs(ghUser.data!.login),
    enabled: githubSet && Boolean(ghUser.data?.login),
  });
  const reviews = useQuery({
    queryKey: ['review-queue', ghUser.data?.login],
    queryFn: () => getReviewRequests(ghUser.data!.login),
    enabled: githubSet && Boolean(ghUser.data?.login),
  });

  const twUser = useQuery({
    queryKey: ['teamwork-user'],
    queryFn: getTeamworkUser,
    enabled: teamworkSet,
    retry: false,
  });
  const twEntries = useQuery({
    queryKey: ['teamwork-time-this-week', twUser.data?.id],
    queryFn: () =>
      getMyTimeEntries(
        twUser.data!.id,
        teamworkDate(weekStart()),
        teamworkDate(weekEnd()),
      ),
    enabled: teamworkSet && Boolean(twUser.data?.id),
  });

  const worktrees = useQuery({
    queryKey: ['worktree-data'],
    queryFn: fetchWorktreeData,
  });

  if (!githubSet && !teamworkSet) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h2 className="text-2xl font-semibold mb-2">Welcome</h2>
        <p className="text-sm text-slate-500 mb-6">
          Add your GitHub and Teamwork tokens to populate the dashboard.
          Tokens stay in your browser — they never leave your machine.
        </p>
        <Link
          to="/settings"
          className="inline-block px-5 py-2.5 text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
        >
          Open Settings →
        </Link>
      </div>
    );
  }

  // Worktree summary
  const wtTotal = worktrees.data?.plugins.reduce((sum, p) => sum + p.worktrees.length, 0) ?? 0;
  const wtPendingCommit = worktrees.data?.plugins.flatMap(p => p.worktrees)
    .filter(w => w.status?.toLowerCase().includes('pending commit'))
    .length ?? 0;

  // Teamwork summary
  const hoursThisWeek = twEntries.data ? sumHours(twEntries.data) : 0;
  const pctOfTarget = (hoursThisWeek / WEEKLY_TARGET_HOURS) * 100;
  const hoursAccent =
    pctOfTarget >= 100
      ? 'text-emerald-600 dark:text-emerald-400'
      : pctOfTarget >= 75
      ? ''
      : pctOfTarget >= 50
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400';

  // Oldest waiting review
  const oldestReview = reviews.data?.[0];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">
          {ghUser.data ? `Hi ${ghUser.data.name?.split(' ')[0] || ghUser.data.login}` : 'Overview'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open PRs you authored"
          value={!githubSet ? '—' : myPRs.isLoading ? '…' : myPRs.data?.length ?? 0}
          to="/my-prs"
        />
        <StatCard
          label="PRs awaiting your review"
          value={!githubSet ? '—' : reviews.isLoading ? '…' : reviews.data?.length ?? 0}
          sublabel={oldestReview ? `Oldest: ${relativeTime(oldestReview.created_at)}` : undefined}
          to="/review-queue"
          accent={(reviews.data?.length ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <StatCard
          label="Active worktrees"
          value={worktrees.isLoading ? '…' : wtTotal}
          sublabel={wtPendingCommit > 0 ? `${wtPendingCommit} pending commit` : undefined}
          to="/worktrees"
        />
        <StatCard
          label="Hours this week"
          value={!teamworkSet ? '—' : twEntries.isLoading ? '…' : `${hoursThisWeek.toFixed(1)}`}
          sublabel={teamworkSet ? `of ${WEEKLY_TARGET_HOURS}h target` : undefined}
          to="/time"
          accent={hoursAccent}
        />
      </section>

      {/* Highlights */}
      {githubSet && (myPRs.data?.length || reviews.data?.length) ? (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Highlights
          </h3>
          <ul className="space-y-2 text-sm">
            {reviews.data?.slice(0, 3).map((pr) => (
              <li
                key={pr.id}
                className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-800 rounded-md"
              >
                <span className="text-amber-600 dark:text-amber-400">📥</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={pr.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline truncate block"
                  >
                    {pr.title}
                  </a>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Waiting on your review · opened {relativeTime(pr.created_at)}
                  </p>
                </div>
              </li>
            ))}
            {myPRs.data?.filter(p => !p.draft).slice(0, 2).map((pr) => (
              <li
                key={pr.id}
                className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-800 rounded-md"
              >
                <span className="text-blue-600 dark:text-blue-400">📤</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={pr.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline truncate block"
                  >
                    {pr.title}
                  </a>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your PR · updated {relativeTime(pr.updated_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
