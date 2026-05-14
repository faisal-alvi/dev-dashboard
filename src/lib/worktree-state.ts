/**
 * Derive a worktree's workflow state from its git, status, and any matching PR.
 *
 * The state is a single, deterministic value that drives:
 *  - The visual badge (color + icon + label)
 *  - The "Next step" shown to the user
 *  - Which action buttons appear (Draft PR vs Open PR vs Add Review)
 *
 * This replaces the old approach of relying on free-text `status` strings,
 * which were inconsistent and didn't capture the full picture.
 */

import type { Worktree } from './worktrees';
import type { PullRequest } from './github';

export type WorktreeState =
  | 'implementing'
  | 'ready_for_pr'
  | 'pr_draft'
  | 'in_review'
  | 'reviewing'
  | 'merged'
  | 'unknown';

export interface DerivedState {
  state: WorktreeState;
  label: string;
  icon: string;
  /** Tailwind class for accent (border-l-4, badge bg, etc.) */
  accentColor: string;
  /** Tailwind classes for the badge background. */
  badgeClass: string;
  /** Plain-English "what to do next". */
  nextStep: string;
}

const STATE_META: Record<WorktreeState, Omit<DerivedState, 'state' | 'nextStep'>> = {
  implementing: {
    label: 'Implementing',
    icon: '⚒️',
    accentColor: 'border-l-amber-500',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  ready_for_pr: {
    label: 'Ready for PR',
    icon: '✓',
    accentColor: 'border-l-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  pr_draft: {
    label: 'PR draft',
    icon: '📝',
    accentColor: 'border-l-blue-500',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  },
  in_review: {
    label: 'In review',
    icon: '👀',
    accentColor: 'border-l-violet-500',
    badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
  },
  reviewing: {
    label: 'Reviewing (theirs)',
    icon: '🔍',
    accentColor: 'border-l-teal-500',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  },
  merged: {
    label: 'Merged',
    icon: '✅',
    accentColor: 'border-l-slate-400',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  unknown: {
    label: 'Unknown',
    icon: '❓',
    accentColor: 'border-l-slate-200 dark:border-l-slate-700',
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
};

export function deriveWorktreeState(
  wt: Worktree,
  matchingPR: PullRequest | undefined,
): DerivedState {
  let state: WorktreeState;
  let nextStep: string;

  const uncommitted = wt.git.staged + wt.git.modified + wt.git.untracked;

  if (matchingPR) {
    if (matchingPR.draft) {
      state = 'pr_draft';
      nextStep = uncommitted > 0
        ? 'Commit remaining changes, then mark PR ready for review on GitHub'
        : 'Mark PR as "Ready for review" on GitHub when implementation is complete';
    } else {
      state = 'in_review';
      nextStep = uncommitted > 0
        ? 'You have uncommitted local changes — push them or stash before merge'
        : 'Address any review comments; merge when approved';
    }
  } else if (/-pr$/.test(wt.branch)) {
    state = 'reviewing';
    nextStep = wt.review_status === 'Approved'
      ? 'Open PR on GitHub and submit your pending review'
      : 'Run /review-ticket if not done; draft your review via Add review button';
  } else if (wt.status && /merged|closed/i.test(wt.status)) {
    state = 'merged';
    nextStep = 'Run /cleanup-ticket to remove the worktree and symlinks';
  } else if (uncommitted > 0) {
    state = 'implementing';
    nextStep = wt.next_action
      ? wt.next_action
      : wt.git.ahead === 0
      ? 'Commit your changes, then push to open a draft PR'
      : 'Finish the remaining changes and commit them';
  } else if (wt.git.ahead > 0) {
    state = 'ready_for_pr';
    nextStep = wt.next_action
      ? wt.next_action
      : 'Open a draft PR with the Draft PR button';
  } else {
    state = 'unknown';
    nextStep = wt.next_action
      ? wt.next_action
      : 'No status info. Open status.md in this worktree to set the next action';
  }

  return {
    state,
    nextStep,
    ...STATE_META[state],
  };
}
