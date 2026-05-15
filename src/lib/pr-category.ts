import type { PRReviewData } from './github';

export type PRCategory =
  | 'changes_requested'
  | 'feedback_received'
  | 'partially_approved'
  | 'awaiting_review'
  | 'approved'
  | 'no_reviews';

export interface PRCategoryMeta {
  label: string;
  description: string;
  dot: string;         // tailwind bg color for the dot
  badge: string;       // tailwind classes for the count badge
  defaultOpen: boolean;
}

export const CATEGORY_ORDER: PRCategory[] = [
  'changes_requested',
  'feedback_received',
  'partially_approved',
  'awaiting_review',
  'approved',
  'no_reviews',
];

export const CATEGORY_META: Record<PRCategory, PRCategoryMeta> = {
  changes_requested: {
    label: 'Changes requested',
    description: 'Reviewers asked for changes — needs your attention',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    defaultOpen: true,
  },
  feedback_received: {
    label: 'Feedback received',
    description: 'Reviewers left comments — worth reading before proceeding',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    defaultOpen: true,
  },
  partially_approved: {
    label: 'Partially approved',
    description: 'Some approvals in, still waiting on others',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    defaultOpen: true,
  },
  awaiting_review: {
    label: 'Awaiting review',
    description: 'Reviewers requested but none have submitted yet',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    defaultOpen: true,
  },
  approved: {
    label: 'Approved',
    description: 'All clear — ready to merge',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    defaultOpen: true,
  },
  no_reviews: {
    label: 'No review activity',
    description: 'No reviewers assigned or no reviews submitted',
    dot: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
    defaultOpen: false,
  },
};

export function derivePRCategory(data: PRReviewData | undefined): PRCategory {
  if (!data) return 'no_reviews';

  const { reviews, requestedReviewers } = data;

  // Latest non-pending review per user
  const latestByUser = new Map<string, typeof reviews[0]>();
  for (const r of reviews) {
    if (!r.user || r.state === 'PENDING') continue;
    const existing = latestByUser.get(r.user.login);
    if (!existing || (r.submitted_at ?? '') > (existing.submitted_at ?? '')) {
      latestByUser.set(r.user.login, r);
    }
  }

  const approvedCount = [...latestByUser.values()].filter(r => r.state === 'APPROVED').length;
  const changesCount = [...latestByUser.values()].filter(r => r.state === 'CHANGES_REQUESTED').length;
  const commentedCount = [...latestByUser.values()].filter(r => r.state === 'COMMENTED').length;
  const pendingCount = requestedReviewers.filter(r => !latestByUser.has(r.login)).length;

  if (changesCount > 0) return 'changes_requested';
  if (approvedCount > 0 && pendingCount === 0) return 'approved';
  if (approvedCount > 0 && pendingCount > 0) return 'partially_approved';
  if (commentedCount > 0) return 'feedback_received';
  if (pendingCount > 0) return 'awaiting_review';
  return 'no_reviews';
}
