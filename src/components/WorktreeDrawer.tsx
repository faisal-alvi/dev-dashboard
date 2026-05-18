import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import type { WorktreeDoc } from '../lib/worktrees';

marked.use({ gfm: true });

function MarkdownBody({ content }: { content: string }) {
  const html = marked.parse(content) as string;
  return (
    <div
      className="markdown-body text-sm px-4 pb-5 pt-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function AccordionItem({
  doc,
  defaultOpen,
}: {
  doc: WorktreeDoc;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
      >
        <span className="text-slate-700 dark:text-slate-200">{doc.label}</span>
        <span className="text-slate-400 text-xs ml-2 shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && <MarkdownBody content={doc.content} />}
    </div>
  );
}

interface Props {
  ticket: string;
  plugin: string;
  docs: WorktreeDoc[] | null;
  open: boolean;
  onClose: () => void;
}

export default function WorktreeDrawer({ ticket, plugin, docs, open, onClose }: Props) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* backdrop */}
      <div
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* panel */}
      <div className="w-[680px] max-w-[92vw] bg-white dark:bg-slate-900 flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-700">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
              {ticket}
            </span>
            <span className="text-xs text-slate-500 truncate">{plugin}</span>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-base leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto">
          {docs === null ? (
            <div className="p-6 text-sm text-slate-400 text-center">
              Loading docs…
            </div>
          ) : docs.length === 0 ? (
            <div className="p-6 text-sm text-slate-400 text-center">
              No docs found. Run <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/sync-dashboard</code> to generate them.
            </div>
          ) : (
            docs.map((doc, i) => (
              <AccordionItem key={doc.name} doc={doc} defaultOpen={i === 0} />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
