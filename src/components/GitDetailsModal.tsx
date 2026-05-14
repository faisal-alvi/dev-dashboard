import Modal from './Modal';
import CopyButton from './CopyButton';
import type { Worktree } from '../lib/worktrees';
import { worktreePath } from '../lib/constants';

interface Props {
  open: boolean;
  onClose: () => void;
  wt: Worktree;
  plugin: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ' M': { label: 'Modified', color: 'text-amber-600 dark:text-amber-400' },
  'M ': { label: 'Staged (modified)', color: 'text-emerald-600 dark:text-emerald-400' },
  'MM': { label: 'Staged + modified', color: 'text-emerald-600 dark:text-emerald-400' },
  ' D': { label: 'Deleted', color: 'text-rose-600 dark:text-rose-400' },
  'D ': { label: 'Staged (deleted)', color: 'text-emerald-600 dark:text-emerald-400' },
  'A ': { label: 'Staged (new)', color: 'text-emerald-600 dark:text-emerald-400' },
  'AM': { label: 'Staged (new) + modified', color: 'text-emerald-600 dark:text-emerald-400' },
  '??': { label: 'Untracked', color: 'text-slate-500' },
  'R ': { label: 'Renamed', color: 'text-emerald-600 dark:text-emerald-400' },
};

function statusMeta(s: string) {
  return STATUS_LABELS[s] ?? { label: s.trim() || 'changed', color: 'text-slate-500' };
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export default function GitDetailsModal({ open, onClose, wt, plugin }: Props) {
  const path = worktreePath(plugin, wt.ticket);
  const files = wt.git.files ?? [];
  const commits = wt.git.recent_commits ?? [];

  const cdCmd = `cd ${path}`;
  const addAll = `git add -A`;
  const commitCmd = `git commit -m "WIP"`;
  const pushCmd = `git push -u origin ${wt.branch}`;
  const fullFlow = `cd ${path} && git add -A && git status`;

  return (
    <Modal open={open} onClose={onClose} title={`Git — ${wt.ticket}`} size="xl">
      <div className="space-y-5">
        {/* Branch + stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border border-slate-200 dark:border-slate-800 rounded p-3">
            <div className="text-xs text-slate-500">Branch</div>
            <div className="font-mono text-xs truncate mt-0.5">{wt.branch}</div>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded p-3">
            <div className="text-xs text-slate-500">Ahead / Behind</div>
            <div className="font-mono text-xs mt-0.5">
              ↑{wt.git.ahead} ↓{wt.git.behind}
            </div>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded p-3">
            <div className="text-xs text-slate-500">Staged / Modified</div>
            <div className="font-mono text-xs mt-0.5">
              {wt.git.staged} / {wt.git.modified}
            </div>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded p-3">
            <div className="text-xs text-slate-500">Untracked</div>
            <div className="font-mono text-xs mt-0.5">{wt.git.untracked}</div>
          </div>
        </div>

        {/* Files */}
        {files.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Changed files ({files.length})
            </h3>
            <div className="border border-slate-200 dark:border-slate-800 rounded max-h-60 overflow-y-auto">
              <ul className="text-xs font-mono divide-y divide-slate-100 dark:divide-slate-800">
                {files.map((f) => {
                  const meta = statusMeta(f.status);
                  return (
                    <li key={f.path} className="px-3 py-1.5 flex items-center gap-3">
                      <span
                        className={`w-32 text-xs ${meta.color} flex-shrink-0`}
                        title={f.status}
                      >
                        {meta.label}
                      </span>
                      <span className="truncate">{f.path}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* Commits */}
        {commits.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Recent commits ({commits.length})
            </h3>
            <ul className="text-xs space-y-1.5">
              {commits.map((c) => (
                <li
                  key={c.sha}
                  className="flex items-baseline gap-3 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded"
                >
                  <span className="font-mono text-slate-500 flex-shrink-0 w-14">
                    {c.sha}
                  </span>
                  <span className="flex-1 truncate">{c.message}</span>
                  <span className="text-slate-400 flex-shrink-0 text-xs">
                    {c.author} · {relativeDate(c.date)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Commands */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Commands</h3>
          <p className="text-xs text-slate-500 mb-2">
            The dashboard can't run shell commands directly — copy these and run
            in your terminal.
          </p>
          <div className="space-y-2">
            <CommandRow label="cd into worktree" cmd={cdCmd} />
            <CommandRow label="Stage all changes" cmd={addAll} />
            <CommandRow label="Commit with placeholder" cmd={commitCmd} />
            <CommandRow label="Push (set upstream)" cmd={pushCmd} />
            <CommandRow
              label="Full: cd + add + status"
              cmd={fullFlow}
              hint="Quick start — see what's about to be staged"
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}

function CommandRow({
  label,
  cmd,
  hint,
}: {
  label: string;
  cmd: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2 border border-slate-200 dark:border-slate-800 rounded">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <code className="block font-mono text-xs truncate mt-0.5">{cmd}</code>
        {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
      </div>
      <CopyButton value={cmd} label="Copy" />
    </div>
  );
}
