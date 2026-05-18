import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { marked } from 'marked';
import { fetchWorktreeDocs, type WorktreeDoc } from '../lib/worktrees';

marked.use({ gfm: true });

function MarkdownBody({ content }: { content: string }) {
  const html = marked.parse(content) as string;
  return (
    <div
      className="markdown-body text-sm px-5 pb-6 pt-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function AccordionItem({ doc, defaultOpen }: { doc: WorktreeDoc; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
          {doc.label}
        </span>
        <span className="text-slate-400 text-xs ml-2 shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && <MarkdownBody content={doc.content} />}
    </div>
  );
}

export default function WorktreeDetail() {
  const { ticket } = useParams<{ ticket: string }>();
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  const docsQ = useQuery({
    queryKey: ['worktree-docs'],
    queryFn: fetchWorktreeDocs,
    staleTime: 30 * 1000,
    enabled: isLocal,
  });

  if (!isLocal) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold mb-2">Local only</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Worktree docs contain private ticket content and are only available locally.
        </p>
      </div>
    );
  }

  const backLink = (
    <Link
      to="/worktrees"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6"
    >
      ← Worktrees
    </Link>
  );

  if (docsQ.isLoading) {
    return (
      <div>
        {backLink}
        <div className="space-y-3 mt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!docsQ.data) {
    return (
      <div>
        {backLink}
        <p className="text-sm text-slate-500">
          No docs found. Run{' '}
          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            /sync-dashboard
          </code>{' '}
          locally to generate them.
        </p>
      </div>
    );
  }

  let pluginName = '';
  let docs: WorktreeDoc[] = [];
  for (const plugin of docsQ.data.plugins) {
    const entry = plugin.worktrees.find((w) => w.ticket === ticket);
    if (entry) {
      pluginName = plugin.name;
      docs = entry.docs;
      break;
    }
  }

  if (!docs.length) {
    return (
      <div>
        {backLink}
        <p className="text-sm text-slate-500">
          No docs found for <code className="font-mono">{ticket}</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {backLink}
      <div className="mb-6">
        <h2 className="text-xl font-bold font-mono">{ticket}</h2>
        {pluginName && (
          <p className="text-sm text-slate-500 mt-0.5">{pluginName}</p>
        )}
      </div>
      <div className="space-y-3">
        {docs.map((doc, i) => (
          <AccordionItem key={doc.name} doc={doc} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
