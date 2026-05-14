import { useState } from 'react';

type Mode = 'start-ticket' | 'review-ticket';

function buildCommand(mode: Mode, input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (mode === 'start-ticket') {
    return `/start-ticket\n${trimmed}`;
  }
  return `/review-ticket ${trimmed}`;
}

export default function QuickStart() {
  const [mode, setMode] = useState<Mode>('start-ticket');
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  const cmd = buildCommand(mode, input);
  const canCopy = cmd.length > 0;

  const onCopy = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignored
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Quick Start</h2>
      <p className="text-sm text-slate-500 mb-6">
        Build a command, copy it, then paste into Claude Code to run.
        The dashboard can't execute shell commands — the clipboard is the bridge.
      </p>

      <div className="flex gap-2 mb-5 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setMode('start-ticket')}
          className={`px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
            mode === 'start-ticket'
              ? 'border-blue-600 text-blue-700 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          ▶️ Start ticket
        </button>
        <button
          onClick={() => setMode('review-ticket')}
          className={`px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
            mode === 'review-ticket'
              ? 'border-blue-600 text-blue-700 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          🔍 Review ticket
        </button>
      </div>

      {mode === 'start-ticket' ? (
        <p className="text-xs text-slate-500 mb-3">
          Paste the full Linear ticket below (URL on the first line, then title, description,
          comments). The <code>/start-ticket</code> command will scaffold a worktree, set up
          docs, reproduce the bug, and start implementation.
        </p>
      ) : (
        <p className="text-xs text-slate-500 mb-3">
          Paste a GitHub PR URL below (e.g. <code>https://github.com/woocommerce/...pull/4276</code>).
          The <code>/review-ticket</code> command will check out the PR, set up docs, and run
          the wp-pr-reviewer agent.
        </p>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={mode === 'start-ticket' ? 16 : 4}
        placeholder={
          mode === 'start-ticket'
            ? 'https://linear.app/a8c/issue/...\n\nTicket title\n\nDescription...'
            : 'https://github.com/woocommerce/woocommerce-bookings/pull/4276'
        }
        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 font-mono"
      />

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Preview
        </h3>
        <pre className="text-xs font-mono p-3 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-900/50 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {cmd || <span className="text-slate-400">(paste content above to build the command)</span>}
        </pre>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onCopy}
          disabled={!canCopy}
          className="px-4 py-2 text-sm rounded bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? '✓ Copied — now paste in Claude Code' : 'Copy command'}
        </button>
      </div>

      <div className="mt-8 p-4 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-900/30 text-xs text-slate-600 dark:text-slate-400">
        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
          What happens next
        </div>
        <ol className="list-decimal list-inside space-y-1 ml-1">
          <li>Open a Claude Code terminal session in the plugins directory.</li>
          <li>Paste the copied command and hit enter.</li>
          <li>
            The command will run autonomously — scaffold the worktree, run setup steps,
            and stop at the appropriate checkpoint for your review.
          </li>
          <li>
            When done, run <code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">/standup</code>{' '}
            to auto-sync this dashboard with the new worktree.
          </li>
        </ol>
      </div>
    </div>
  );
}
