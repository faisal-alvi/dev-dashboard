import { useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { getCurrentUser, getMyOpenPRs, getPRReviewData, type PRReviewData, type PullRequest } from '../lib/github';
import { hasToken } from '../lib/tokens';
import PRList from '../components/PRList';
import { Link } from 'react-router-dom';
import {
  derivePRCategory,
  CATEGORY_ORDER,
  CATEGORY_META,
  type PRCategory,
} from '../lib/pr-category';

function PRSection({
  category,
  prs,
  reviewsByPR,
  reviewsLoading,
}: {
  category: PRCategory;
  prs: PullRequest[];
  reviewsByPR: Map<string, PRReviewData>;
  reviewsLoading: boolean;
}) {
  const meta = CATEGORY_META[category];
  const [open, setOpen] = useState(meta.defaultOpen);

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 py-2 text-left group"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-1">
          {meta.label}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${meta.badge}`}>
          {prs.length}
        </span>
        {reviewsLoading && (
          <span className="text-xs text-slate-400 italic">loading reviews…</span>
        )}
        <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors ml-1">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="mt-2 mb-6">
          <PRList prs={prs} reviewsByPR={reviewsByPR} emptyMessage="" />
        </div>
      )}
    </section>
  );
}

export default function MyPRs() {
  const tokenSet = hasToken('github');

  const user = useQuery({
    queryKey: ['github-user'],
    queryFn: getCurrentUser,
    enabled: tokenSet,
  });

  const prs = useQuery({
    queryKey: ['my-prs', user.data?.login],
    queryFn: () => getMyOpenPRs(user.data!.login),
    enabled: tokenSet && Boolean(user.data?.login),
  });

  const prList = useMemo(() =>
    (prs.data ?? []).map((pr) => {
      const repo = pr.head?.repo?.full_name
        ?? pr.html_url.match(/github\.com\/([^/]+\/[^/]+)\/pull/)?.[1]
        ?? '';
      return { repo, number: pr.number };
    }).filter((p) => p.repo),
    [prs.data],
  );

  const reviewsQueries = useQueries({
    queries: prList.map((p) => ({
      queryKey: ['pr-review-data', p.repo, p.number],
      queryFn: () => getPRReviewData(p.repo, p.number),
      staleTime: 5 * 60 * 1000,
      enabled: tokenSet && prList.length > 0,
    })),
  });

  const reviewsLoading = reviewsQueries.some((q) => q.isLoading);

  const reviewsByPR = useMemo(() => {
    const map = new Map<string, PRReviewData>();
    prList.forEach((p, i) => {
      const data = reviewsQueries[i]?.data;
      if (data) map.set(`${p.repo}#${p.number}`, data);
    });
    return map;
  }, [prList, reviewsQueries]);

  // Group PRs by category once review data is available
  const groups = useMemo(() => {
    const map = new Map<PRCategory, PullRequest[]>();
    for (const pr of prs.data ?? []) {
      const repo = pr.head?.repo?.full_name
        ?? pr.html_url.match(/github\.com\/([^/]+\/[^/]+)\/pull/)?.[1]
        ?? '';
      const reviewData = reviewsByPR.get(`${repo}#${pr.number}`);
      const cat = derivePRCategory(reviewData);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(pr);
    }
    return map;
  }, [prs.data, reviewsByPR]);

  if (!tokenSet) {
    return (
      <div className="text-sm text-slate-500">
        Add your GitHub token in{' '}
        <Link to="/settings" className="underline">
          Settings
        </Link>{' '}
        to see your PRs.
      </div>
    );
  }

  if (prs.isLoading || user.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (prs.isError || user.isError) {
    return (
      <p className="text-sm text-red-600">
        Error loading PRs: {(prs.error || user.error)?.message}
      </p>
    );
  }

  const allPRs = prs.data ?? [];

  if (allPRs.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">My Open PRs</h2>
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center text-sm text-slate-500">
          No open PRs. 🎉
        </div>
      </div>
    );
  }

  const activeCategories = CATEGORY_ORDER.filter((cat) => groups.has(cat));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-xl font-semibold">My Open PRs</h2>
        <span className="text-xs text-slate-500">
          {allPRs.length} open · {activeCategories.length} {activeCategories.length === 1 ? 'group' : 'groups'}
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {activeCategories.map((cat) => (
          <PRSection
            key={cat}
            category={cat}
            prs={groups.get(cat)!}
            reviewsByPR={reviewsByPR}
            reviewsLoading={reviewsLoading}
          />
        ))}
      </div>
    </div>
  );
}
