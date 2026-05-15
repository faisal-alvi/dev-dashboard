import type { PRReviewData } from '../lib/github';

export default function ReviewStatus({ data }: { data: PRReviewData | undefined }) {
  if (!data) return null;

  const { reviews, requestedReviewers } = data;

  // Latest non-pending review per user (pending = draft not submitted yet)
  const latestByUser = new Map<string, typeof reviews[0]>();
  for (const r of reviews) {
    if (!r.user) continue;
    if (r.state === 'PENDING') continue;
    const existing = latestByUser.get(r.user.login);
    if (!existing || (r.submitted_at ?? '') > (existing.submitted_at ?? '')) {
      latestByUser.set(r.user.login, r);
    }
  }

  const approved = [...latestByUser.values()].filter(r => r.state === 'APPROVED');
  const changesRequested = [...latestByUser.values()].filter(r => r.state === 'CHANGES_REQUESTED');
  const commented = [...latestByUser.values()].filter(r => r.state === 'COMMENTED');
  // Pending = requested but no review submitted yet (or review was dismissed)
  const pending = requestedReviewers.filter(r => !latestByUser.has(r.login));

  if (approved.length === 0 && changesRequested.length === 0 && commented.length === 0 && pending.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {approved.length > 0 && (
        <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <span>✓</span>
          <span>{approved.map(r => r.user!.login).join(', ')}</span>
        </span>
      )}
      {changesRequested.length > 0 && (
        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
          <span>⊘</span>
          <span>{changesRequested.map(r => r.user!.login).join(', ')}</span>
        </span>
      )}
      {commented.length > 0 && (
        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <span>💬</span>
          <span>{commented.map(r => r.user!.login).join(', ')}</span>
        </span>
      )}
      {pending.length > 0 && (
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <span>⏳</span>
          <span>{pending.map(r => r.login).join(', ')}</span>
        </span>
      )}
    </div>
  );
}
