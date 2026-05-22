import { useState, useMemo } from 'react';
import { marked } from 'marked';
import Modal from './Modal';
import type { Worktree } from '../lib/worktrees';
import type { PullRequest, PRReviewData } from '../lib/github';
// linearUrl import removed — we now use wt.linear_url extracted from docs
import ReviewStatus from './ReviewStatus';

interface Props {
  open: boolean;
  onClose: () => void;
  wt: Worktree;
  plugin?: string;
  pr?: PullRequest;
  reviews?: PRReviewData;
  noPR?: boolean; // confirmed: branch lookup done, no PR found
}

// ─── status labels ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ' M': { label: 'Modified',           color: 'text-amber-600 dark:text-amber-400' },
  'M ': { label: 'Staged (modified)',   color: 'text-emerald-600 dark:text-emerald-400' },
  'MM': { label: 'Staged + modified',  color: 'text-emerald-600 dark:text-emerald-400' },
  ' D': { label: 'Deleted',            color: 'text-rose-600 dark:text-rose-400' },
  'D ': { label: 'Staged (deleted)',   color: 'text-emerald-600 dark:text-emerald-400' },
  'A ': { label: 'Staged (new)',        color: 'text-emerald-600 dark:text-emerald-400' },
  'AM': { label: 'Staged (new) + mod', color: 'text-emerald-600 dark:text-emerald-400' },
  '??': { label: 'Untracked',          color: 'text-slate-500' },
  'R ': { label: 'Renamed',            color: 'text-emerald-600 dark:text-emerald-400' },
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

// ─── PR body ─────────────────────────────────────────────────────────────────

function PRBodySection({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  const html = useMemo(() => marked(body, { async: false }) as string, [body]);
  return (
    <div className="border-t border-violet-100 dark:border-violet-900">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors"
      >
        <span className="text-violet-400 dark:text-violet-500 text-xs">{open ? '▼' : '▶'}</span>
        <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Description</span>
      </button>
      {open && (
        <div
          className="px-4 pb-3 max-h-80 overflow-y-auto markdown-body text-xs"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

// ─── diff parser ──────────────────────────────────────────────────────────────

interface DiffFile {
  filename: string;
  added: number;
  removed: number;
  lines: string[];
}

function parseDiff(raw: string): DiffFile[] {
  const files: DiffFile[] = [];
  // Split on "diff --git" boundaries
  const sections = raw.split(/^(?=diff --git )/m).filter(Boolean);
  for (const section of sections) {
    const lines = section.split('\n');
    // Extract filename from "diff --git a/foo b/foo" or "+++ b/foo"
    let filename = '';
    const headerMatch = lines[0]?.match(/diff --git a\/.+ b\/(.+)/);
    if (headerMatch) filename = headerMatch[1];
    // Fallback: scan for +++ b/... line
    if (!filename) {
      for (const l of lines) {
        const m = l.match(/^\+\+\+ b\/(.+)/);
        if (m) { filename = m[1]; break; }
      }
    }
    // Count +/- (skip +++ / --- meta lines)
    let added = 0, removed = 0;
    for (const l of lines) {
      if (l.startsWith('+') && !l.startsWith('+++')) added++;
      if (l.startsWith('-') && !l.startsWith('---')) removed++;
    }
    files.push({ filename: filename || lines[0], added, removed, lines });
  }
  return files;
}

// ─── diff line renderer ───────────────────────────────────────────────────────

interface LineInfo {
  line: string;
  oldNum: number | null;
  newNum: number | null;
}

function computeLineNumbers(lines: string[]): LineInfo[] {
  const result: LineInfo[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of lines) {
    if (line.startsWith('@@')) {
      const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldLine = parseInt(m[1], 10); newLine = parseInt(m[2], 10); }
      result.push({ line, oldNum: null, newNum: null });
    } else if (
      line.startsWith('+++') || line.startsWith('---') ||
      line.startsWith('diff ') || line.startsWith('index ') ||
      line.startsWith('new file') || line.startsWith('deleted file')
    ) {
      result.push({ line, oldNum: null, newNum: null });
    } else if (line.startsWith('+')) {
      result.push({ line, oldNum: null, newNum: newLine++ });
    } else if (line.startsWith('-')) {
      result.push({ line, oldNum: oldLine++, newNum: null });
    } else {
      result.push({ line, oldNum: oldLine++, newNum: newLine++ });
    }
  }
  return result;
}

function diffLineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-slate-400 dark:text-slate-500 select-none';
  if (line.startsWith('+')) return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300';
  if (line.startsWith('-')) return 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300';
  if (line.startsWith('@@')) return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400';
  if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file')) return 'text-slate-400 dark:text-slate-500 select-none';
  return 'text-slate-700 dark:text-slate-300';
}

function gutterNumClass(line: string): string {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-500';
  if (line.startsWith('-') && !line.startsWith('---')) return 'bg-rose-100 dark:bg-rose-950/60 text-rose-500 dark:text-rose-400';
  return 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500';
}

function FileDiff({ file }: { file: DiffFile }) {
  const [open, setOpen] = useState(false);
  const shortName = file.filename.split('/').pop() ?? file.filename;
  const dir = file.filename.includes('/') ? file.filename.slice(0, file.filename.lastIndexOf('/') + 1) : '';
  const lineInfos = useMemo(() => computeLineNumbers(file.lines), [file.lines]);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* File header — always visible, click to expand */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
      >
        <span className="text-slate-400 dark:text-slate-500 text-xs">{open ? '▼' : '▶'}</span>
        <span className="flex-1 min-w-0 font-mono text-xs truncate">
          {dir && <span className="text-slate-400 dark:text-slate-500">{dir}</span>}
          <span className="text-slate-800 dark:text-slate-200 font-medium">{shortName}</span>
        </span>
        <span className="flex-shrink-0 flex items-center gap-2 text-xs font-mono">
          {file.added > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{file.added}</span>}
          {file.removed > 0 && <span className="text-rose-500 dark:text-rose-400">−{file.removed}</span>}
        </span>
      </button>

      {/* Diff body */}
      {open && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto border-t border-slate-200 dark:border-slate-700">
          <pre className="text-[11px] font-mono leading-5">
            {lineInfos.map(({ line, oldNum, newNum }, i) => (
              <div key={i} className={`flex whitespace-pre ${diffLineClass(line)}`}>
                {/* Gutter: old line number */}
                <span className={`select-none flex-shrink-0 w-10 text-right pr-2 border-r border-slate-200 dark:border-slate-700 ${gutterNumClass(line)}`}>
                  {oldNum != null ? oldNum : ''}
                </span>
                {/* Gutter: new line number */}
                <span className={`select-none flex-shrink-0 w-10 text-right pr-2 border-r border-slate-200 dark:border-slate-700 mr-2 ${gutterNumClass(line)}`}>
                  {newNum != null ? newNum : ''}
                </span>
                {/* Line content */}
                <span className="flex-1">{line || ' '}</span>
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── main modal ───────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function GitDetailsModal({ open, onClose, wt, pr, reviews, noPR }: Props) { // plugin accepted but unused — Worktrees.tsx passes it for legacy compat
  const files = wt.git.files ?? [];
  const commits = wt.git.recent_commits ?? [];
  const diffFiles = wt.git.diff ? parseDiff(wt.git.diff) : [];
  const branchDiffFiles = wt.git.branch_diff ? parseDiff(wt.git.branch_diff) : [];

  return (
    <Modal open={open} onClose={onClose} title={`Git — ${wt.ticket}`} size="xl">
      <div className="space-y-5">

        {/* No PR notice */}
        {!pr && noPR && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 bg-slate-50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 italic">
              <span className="text-base not-italic">🔗</span>
              No PR created for this branch
            </div>
            {wt.linear_url ? (
              <a
                href={wt.linear_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[11px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-1.5 truncate transition-colors"
              >
                {wt.linear_url}
              </a>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 italic">No Linear ticket found</p>
            )}
          </div>
        )}

        {/* Linear link when no PR section is shown */}
        {!pr && !noPR && (
          wt.linear_url ? (
            <a
              href={wt.linear_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[11px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 truncate transition-colors"
            >
              {wt.linear_url}
            </a>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">No Linear ticket found</p>
          )
        )}

        {/* PR metadata */}
        {pr && (
          <div className="border border-violet-200 dark:border-violet-800 rounded-lg bg-violet-50 dark:bg-violet-950/30 overflow-hidden">
            {/* Title + state */}
            <div className="px-4 py-3 border-b border-violet-100 dark:border-violet-900">
              <div className="flex items-start gap-2">
                <a
                  href={pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm font-semibold text-violet-900 dark:text-violet-100 hover:underline leading-snug"
                >
                  {pr.title}
                </a>
                <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  pr.draft
                    ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    : pr.state === 'open'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                }`}>
                  {pr.draft ? 'Draft' : pr.state === 'open' ? 'Open' : 'Closed'}
                </span>
              </div>
              {/* Linear ticket link */}
              {wt.linear_url ? (
                <a
                  href={wt.linear_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[11px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-1 truncate transition-colors"
                >
                  {wt.linear_url}
                </a>
              ) : (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic">No Linear ticket found</p>
              )}
            </div>
            {/* Meta row */}
            <div className="px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-violet-700 dark:text-violet-300">
              {/* Author */}
              <span className="flex items-center gap-1.5">
                <img src={pr.user.avatar_url} alt={pr.user.login} className="w-4 h-4 rounded-full" />
                <span className="font-medium">{pr.user.login}</span>
              </span>
              {/* Target branch */}
              {pr.base?.ref && (
                <span className="flex items-center gap-1">
                  <span className="text-violet-400">→</span>
                  <span className="font-mono">{pr.base.ref}</span>
                </span>
              )}
              {/* PR number */}
              <span className="text-violet-400">#{pr.number}</span>
              {/* Dates */}
              <span title={pr.created_at}>opened {relativeTime(pr.created_at)}</span>
              {pr.updated_at !== pr.created_at && (
                <span title={pr.updated_at}>updated {relativeTime(pr.updated_at)}</span>
              )}
              {/* Commit / diff stats */}
              {pr.commits != null && (
                <span>{pr.commits} commit{pr.commits !== 1 ? 's' : ''}</span>
              )}
              {pr.changed_files != null && (
                <span>{pr.changed_files} file{pr.changed_files !== 1 ? 's' : ''}</span>
              )}
              {pr.additions != null && pr.deletions != null && (
                <span>
                  <span className="text-emerald-600 dark:text-emerald-400">+{pr.additions}</span>
                  {' / '}
                  <span className="text-rose-500 dark:text-rose-400">−{pr.deletions}</span>
                </span>
              )}
              {/* Requested reviewers */}
              {pr.requested_reviewers?.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-violet-400">reviewers:</span>
                  {pr.requested_reviewers.map(r => (
                    <span key={r.login} className="flex items-center gap-0.5">
                      <img src={r.avatar_url} alt={r.login} className="w-3.5 h-3.5 rounded-full" />
                      <span>{r.login}</span>
                    </span>
                  ))}
                </span>
              )}
              {/* Labels */}
              {pr.labels?.length > 0 && (
                <span className="flex items-center gap-1 flex-wrap">
                  {pr.labels.map(l => (
                    <span
                      key={l.name}
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: `#${l.color}22`, color: `#${l.color}`, border: `1px solid #${l.color}55` }}
                    >
                      {l.name}
                    </span>
                  ))}
                </span>
              )}
            </div>
            {/* Review status (approved / changes requested / pending) */}
            {reviews && (
              <div className="px-4 py-2 border-t border-violet-100 dark:border-violet-900">
                <ReviewStatus data={reviews} />
              </div>
            )}
            {/* PR description (collapsible) */}
            {pr.body && <PRBodySection body={pr.body} />}
          </div>
        )}

        {/* Branch + stats */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="border border-slate-200 dark:border-slate-800 rounded p-3">
              <div className="text-xs text-slate-500">Branch</div>
              <div className="font-mono text-xs truncate mt-0.5">{wt.branch}</div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded p-3">
              <div className="text-xs text-slate-500">Ahead / Behind</div>
              <div className="font-mono text-xs mt-0.5">↑{wt.git.ahead} ↓{wt.git.behind}</div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded p-3">
              <div className="text-xs text-slate-500">Staged / Modified</div>
              <div className="font-mono text-xs mt-0.5">{wt.git.staged} / {wt.git.modified}</div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded p-3">
              <div className="text-xs text-slate-500">Untracked</div>
              <div className="font-mono text-xs mt-0.5">{wt.git.untracked}</div>
            </div>
          </div>
        </div>

        {/* Diff — per-file collapsible */}
        {diffFiles.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Uncommitted changes ({diffFiles.length} file{diffFiles.length !== 1 ? 's' : ''})
            </h3>
            <div className="space-y-1.5">
              {diffFiles.map((f) => (
                <FileDiff key={f.filename} file={f} />
              ))}
            </div>
          </section>
        )}

        {/* Committed branch diff */}
        {branchDiffFiles.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Committed changes on branch ({branchDiffFiles.length} file{branchDiffFiles.length !== 1 ? 's' : ''})
            </h3>
            <div className="space-y-1.5">
              {branchDiffFiles.map((f) => (
                <FileDiff key={f.filename} file={f} />
              ))}
            </div>
          </section>
        )}

        {/* Untracked files (not in diff) */}
        {files.filter(f => f.status === '??').length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Untracked files
            </h3>
            <ul className="text-xs font-mono space-y-0.5">
              {files.filter(f => f.status === '??').map(f => (
                <li key={f.path} className="text-slate-500 dark:text-slate-400 px-1">{f.path}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Branch commits */}
        {commits.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Branch commits ({commits.length})
            </h3>
            <ul className="text-xs space-y-1.5">
              {commits.map((c) => {
                const commitUrl = wt.github_repo
                  ? `https://github.com/${wt.github_repo}/commit/${c.sha}`
                  : null;
                return (
                  <li
                    key={c.sha}
                    className="flex items-baseline gap-3 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded"
                  >
                    {commitUrl ? (
                      <a
                        href={commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline flex-shrink-0 w-14"
                      >
                        {c.sha}
                      </a>
                    ) : (
                      <span className="font-mono text-slate-500 flex-shrink-0 w-14">{c.sha}</span>
                    )}
                    <span className="flex-1 truncate">{c.message}</span>
                    <span className="flex-shrink-0 flex items-center gap-1.5 text-xs">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{c.author}</span>
                      <span className="text-slate-400">{relativeDate(c.date)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Empty state */}
        {diffFiles.length === 0 && branchDiffFiles.length === 0 && files.length === 0 && commits.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Working tree is clean.</p>
        )}

      </div>
    </Modal>
  );
}
