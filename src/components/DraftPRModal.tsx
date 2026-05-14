import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createDraftPR, getPRTemplate } from '../lib/github';
import { linearUrl } from '../lib/constants';
import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-filled state — coming from a worktree card. */
  ticket: string;
  ticketTitle: string | null;
  repo: string;
  branch: string;
}

function defaultBody(ticket: string, ticketTitle: string | null): string {
  return `## Summary

${ticketTitle ?? '(Describe what this PR does)'}

## Ticket

[${ticket}](${linearUrl(ticket)})

## Testing

- [ ] Manual verification
- [ ] Regression check on adjacent features
`;
}

/**
 * Hard guarantee: never include AI co-author lines anywhere in PR body.
 * User instruction (memorized).
 */
function sanitize(body: string): string {
  return body
    .split('\n')
    .filter((line) => !/co-?authored-?by:\s*claude/i.test(line))
    .filter((line) => !/🤖.*claude/i.test(line))
    .filter((line) => !/generated.*with.*claude/i.test(line))
    .join('\n');
}

export default function DraftPRModal({
  open,
  onClose,
  ticket,
  ticketTitle,
  repo,
  branch,
}: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState('trunk');
  const [confirmed, setConfirmed] = useState(false);
  const [success, setSuccess] = useState<{ url: string; number: number } | null>(null);

  // Fetch repo PR template (cached by repo)
  const template = useQuery({
    queryKey: ['pr-template', repo],
    queryFn: () => getPRTemplate(repo),
    enabled: open && Boolean(repo),
    staleTime: 60 * 60 * 1000,
  });

  // Reset state when opening
  useEffect(() => {
    if (!open) return;
    setTitle(`${ticket}: ${ticketTitle ?? ''}`.trim().replace(/:\s*$/, ''));
    setConfirmed(false);
    setSuccess(null);
  }, [open, ticket, ticketTitle]);

  // Set body once template resolves
  useEffect(() => {
    if (!open) return;
    if (template.isLoading) return;
    setBody(template.data ?? defaultBody(ticket, ticketTitle));
  }, [open, template.isLoading, template.data, ticket, ticketTitle]);

  const mutation = useMutation({
    mutationFn: () =>
      createDraftPR({
        repo,
        title: title.trim(),
        body: sanitize(body),
        head: branch,
        base,
      }),
    onSuccess: (data) => setSuccess({ url: data.html_url, number: data.number }),
  });

  if (success) {
    return (
      <Modal open={open} onClose={onClose} title="Draft PR created ✓">
        <p className="text-sm mb-4">
          PR <span className="font-mono">#{success.number}</span> created as a draft.
          Open it on GitHub to review and mark "Ready for review" when you're done.
        </p>
        <a
          href={success.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 text-sm rounded bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
        >
          Open PR on GitHub ↗
        </a>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Draft PR — ${ticket}`} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="border border-slate-200 dark:border-slate-800 rounded p-2">
            <div className="text-slate-500 mb-0.5">Repo</div>
            <div className="font-mono truncate">{repo}</div>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded p-2">
            <div className="text-slate-500 mb-0.5">Head</div>
            <div className="font-mono truncate">{branch}</div>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded p-2">
            <div className="text-slate-500 mb-0.5">Base</div>
            <input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="w-full font-mono bg-transparent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Description
            {template.data && (
              <span className="ml-2 text-slate-500 font-normal">
                (loaded from repo's PR template)
              </span>
            )}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 font-mono"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-rose-600">
            {(mutation.error as Error).message}
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I've reviewed the title and description. Create this as a DRAFT PR (will not request reviewers or be marked ready).
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
            disabled={!confirmed || !title.trim() || mutation.isPending}
            className="px-4 py-2 text-sm rounded bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Creating…' : 'Create Draft PR'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
