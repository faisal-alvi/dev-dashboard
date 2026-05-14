import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createPendingReview } from '../lib/github';
import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Repo in "org/name" form. */
  repo: string;
  prNumber: number;
  prTitle: string;
}

/** Strip any AI co-author lines (memorized user rule). */
function sanitize(body: string): string {
  return body
    .split('\n')
    .filter((line) => !/co-?authored-?by:\s*claude/i.test(line))
    .filter((line) => !/🤖.*claude/i.test(line))
    .filter((line) => !/generated.*with.*claude/i.test(line))
    .join('\n');
}

const DEFAULT_BODY = `## Review

(Add your review notes here.)

## Suggestions

`;

export default function AddReviewModal({ open, onClose, repo, prNumber, prTitle }: Props) {
  const [body, setBody] = useState(DEFAULT_BODY);
  const [confirmed, setConfirmed] = useState(false);
  const [success, setSuccess] = useState<{ id: number; url: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setBody(DEFAULT_BODY);
    setConfirmed(false);
    setSuccess(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createPendingReview({
        repo,
        pull_number: prNumber,
        body: sanitize(body),
      }),
    onSuccess: (data) => setSuccess({ id: data.id, url: data.html_url }),
  });

  if (success) {
    return (
      <Modal open={open} onClose={onClose} title="Pending review created ✓">
        <p className="text-sm mb-4">
          Your review has been saved as <strong>pending</strong> on PR{' '}
          <span className="font-mono">#{prNumber}</span>. It is <em>not</em> visible to
          others yet — open the PR on GitHub and click "Submit review" when you're
          ready to publish.
        </p>
        <a
          href={`https://github.com/${repo}/pull/${prNumber}/files`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 text-sm rounded bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
        >
          Open PR to submit ↗
        </a>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add review — PR #${prNumber}`} size="xl">
      <div className="space-y-4">
        <p className="text-xs text-slate-500 truncate">{prTitle}</p>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Review body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 font-mono"
            placeholder="Paste your review notes here…"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-rose-600">
            {(mutation.error as Error).message}
          </p>
        )}

        <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Save as <strong>pending</strong> review. The review will NOT be submitted
            or visible until I open the PR on GitHub and click "Submit review".
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!confirmed || !body.trim() || mutation.isPending}
            className="px-4 py-2 text-sm rounded bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Saving…' : 'Save pending review'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
