import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getCurrentUser,
  getMyTimeEntries,
  sumHours,
  hoursByProject,
  teamworkDate,
  weekStart,
  weekEnd,
} from '../lib/teamwork';
import { hasToken } from '../lib/tokens';
import { WEEKLY_TARGET_HOURS } from '../lib/constants';

function formatHours(h: number): string {
  return h.toFixed(1);
}

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function Time() {
  const tokenSet = hasToken('teamwork');

  const user = useQuery({
    queryKey: ['teamwork-user'],
    queryFn: getCurrentUser,
    enabled: tokenSet,
    retry: false,
  });

  const thisWeek = weekStart();
  const thisWeekEnd = weekEnd();
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastWeekEnd = new Date(thisWeek);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  const thisWeekEntries = useQuery({
    queryKey: ['teamwork-time-this-week', user.data?.id],
    queryFn: () =>
      getMyTimeEntries(
        user.data!.id,
        teamworkDate(thisWeek),
        teamworkDate(thisWeekEnd),
      ),
    enabled: tokenSet && Boolean(user.data?.id),
  });

  const lastWeekEntries = useQuery({
    queryKey: ['teamwork-time-last-week', user.data?.id],
    queryFn: () =>
      getMyTimeEntries(
        user.data!.id,
        teamworkDate(lastWeek),
        teamworkDate(lastWeekEnd),
      ),
    enabled: tokenSet && Boolean(user.data?.id),
  });

  if (!tokenSet) {
    return (
      <div className="text-sm text-slate-500">
        Add your Teamwork API token in{' '}
        <Link to="/settings" className="underline">
          Settings
        </Link>{' '}
        to see your time tracking.
      </div>
    );
  }

  if (user.isError) {
    const err = user.error as Error;
    const isCors = err.message.includes('Failed to fetch');
    return (
      <div className="text-sm">
        <p className="text-red-600 mb-2">Could not reach Teamwork: {err.message}</p>
        {isCors && (
          <p className="text-slate-500">
            This is likely a CORS restriction. Your Teamwork workspace may need
            to allowlist <code className="px-1 bg-slate-100 dark:bg-slate-800 rounded">faisal-alvi.github.io</code>{' '}
            as an allowed origin, or you may need to use a browser extension
            that bypasses CORS during local development.
          </p>
        )}
      </div>
    );
  }

  if (user.isLoading || thisWeekEntries.isLoading) {
    return <p className="text-sm text-slate-500">Loading time data…</p>;
  }

  const thisWeekTotal = sumHours(thisWeekEntries.data ?? []);
  const lastWeekTotal = sumHours(lastWeekEntries.data ?? []);
  const remaining = Math.max(0, WEEKLY_TARGET_HOURS - thisWeekTotal);
  const pctOfTarget = (thisWeekTotal / WEEKLY_TARGET_HOURS) * 100;
  const delta = thisWeekTotal - lastWeekTotal;
  const projects = hoursByProject(thisWeekEntries.data ?? []);
  const billable = projects.reduce((acc, p) => acc + p.billable, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">Time</h2>
        <p className="text-sm text-slate-500">
          Week of {thisWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
          — {thisWeekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Weekly summary */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/50">
          <div className="text-3xl font-semibold">
            {formatHours(thisWeekTotal)}
            <span className="text-base font-normal text-slate-500">
              {' '}/ {WEEKLY_TARGET_HOURS}h
            </span>
          </div>
          <div className="text-sm text-slate-500 mt-1 mb-3">This week</div>
          <ProgressBar
            value={thisWeekTotal}
            max={WEEKLY_TARGET_HOURS}
            color={
              pctOfTarget >= 100
                ? 'bg-emerald-500'
                : pctOfTarget >= 75
                ? 'bg-blue-500'
                : pctOfTarget >= 50
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }
          />
          <div className="text-xs text-slate-500 mt-2">
            {pctOfTarget.toFixed(0)}% of target
          </div>
        </div>

        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/50">
          <div className="text-3xl font-semibold">{formatHours(remaining)}h</div>
          <div className="text-sm text-slate-500 mt-1">Remaining to hit target</div>
          <div className="text-xs text-slate-500 mt-3">
            {remaining > 0 ? `~${formatHours(remaining / Math.max(1, daysLeftInWeek()))}h/day to finish` : 'Target reached 🎉'}
          </div>
        </div>

        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/50">
          <div className="text-3xl font-semibold">
            {delta >= 0 ? '+' : ''}{formatHours(delta)}h
          </div>
          <div className="text-sm text-slate-500 mt-1">vs last week</div>
          <div className="text-xs text-slate-500 mt-3">
            Last week: {formatHours(lastWeekTotal)}h
          </div>
        </div>
      </section>

      {/* Per project breakdown */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          By project ({formatHours(billable)}h billable of {formatHours(thisWeekTotal)}h)
        </h3>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">No time entries logged this week.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.project} className="text-sm">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="truncate pr-2">{p.project}</span>
                  <span className="font-mono text-xs text-slate-500 flex-shrink-0">
                    {formatHours(p.hours)}h
                    {p.billable < p.hours && (
                      <span className="ml-2 text-amber-600">
                        ({formatHours(p.hours - p.billable)}h non-billable)
                      </span>
                    )}
                  </span>
                </div>
                <ProgressBar value={p.hours} max={thisWeekTotal} color="bg-violet-500" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function daysLeftInWeek(): number {
  const now = new Date();
  const end = weekEnd();
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}
