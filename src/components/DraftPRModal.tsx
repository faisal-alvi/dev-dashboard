import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createDraftPR, getPRTemplate } from '../lib/github';
import { linearUrl } from '../lib/constants';
import Modal from './Modal';
import type { Worktree } from '../lib/worktrees';

interface Props {
  open: boolean;
  onClose: () => void;
  wt: Worktree;
  /** Plugin-level PR template, used as fallback if the worktree doesn't have one. */
  pluginTemplate: string | null;
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
 * SAFETY: strip any AI co-author lines anywhere in PR body.
 * User instruction — never put Co-Authored-By: Claude in commits or PRs.
 */
function sanitize(body: string): string {
  return body
    .split('\n')
    .filter((line) => !/co-?authored-?by:\s*claude/i.test(line))
    .filter((line) => !/🤖.*claude/i.test(line))
    .filter((line) => !/generated.*with.*claude/i.test(line))
    .join('\n');
}

export default function DraftPRModal({ open, onClose, wt, pluginTemplate }: Props) {
  const ticket = wt.ticket;
  const repo = wt.github_repo!;
  const branch = wt.branch;
  const ticketTitle = wt.title;
  const uncommitted = wt.git.staged + wt.git.modified + wt.git.untracked;
  const hasNoCommits = wt.git.ahead === 0;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState('trunk');
  const [confirmed, setConfirmed] = useState(false);
  const [success, setSuccess] = useState<{ url: string; number: number } | null>(null);

  // Source priority: worktree template > plugin template > repo .github template > default
  // The first two come from the sync JSON. The third is a fallback API call.
  const needsRepoFetch = !wt.pr_template && !pluginTemplate;
  const repoTemplate = useQuery({
    queryKey: ['pr-template', repo],
    queryFn: () => getPRTemplate(repo),
    enabled: open && Boolean(repo) && needsRepoFetch,
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!open) return;
    setTitle(`${ticket}: ${ticketTitle ?? ''}`.trim().replace(/:\s*$/, ''));
    setConfirmed(false);
    setSuccess(null);
  }, [open, ticket, ticketTitle]);

  useEffect(() => {
    if (!open) return;
    // Wait for repo template fetch if it's needed
    if (needsRepoFetch && repoTemplate.isLoading) return;
    const tpl =
      wt.pr_template ?? pluginTemplate ?? repoTemplate.data ?? defaultBody(ticket, ticketTitle);
    setBody(tpl);
  }, [
    open,
    needsRepoFetch,
    repoTemplate.isLoading,
    repoTemplate.data,
    wt.pr_template,
    pluginTemplate,
    ticket,
    ticketTitle,
  ]);

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

  const blockingWarning =
    hasNoCommits
      ? 'No commits ahead of trunk. Push commits before opening a PR.'
      : null;
  const softWarning =
    uncommitted > 0 && !hasNoCommits
      ? `You have ${uncommitted} uncommitted change(s) locally — they won't be part of this PR. Commit + push them first if you want them included.`
      : null;

  const templateSource = wt.pr_template
    ? 'worktree (.claude/docs/pr-template.md)'
    : pluginTemplate
    ? 'plugin (.claude/docs/pr-template.md)'
    : repoTemplate.data
    ? "repo's .github/PULL_REQUEST_TEMPLATE.md"
    : 'default';

  return (
    <Modal open={open} onClose={onClose} title={`Draft PR — ${ticket}`} size="xl">
      <div className="space-y-4">
        {blockingWarning && (
          <div className="px-3 py-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
            <strong>Cannot create PR yet:</strong> {blockingWarning}
          </div>
        )}
        {softWarning && (
          <div className="px-3 py-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
            ⚠️ {softWarning}
          </div>
        )}

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
            <span className="ml-2 text-slate-500 font-normal">
              (template: {templateSource})
            </span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 font-mono"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-rose-600">{(mutation.error as Error).message}</p>
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
            disabled={
              !confirmed || !title.trim() || mutation.isPending || Boolean(blockingWarning)
            }
            className="px-4 py-2 text-sm rounded bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Creating…' : 'Create Draft PR'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
