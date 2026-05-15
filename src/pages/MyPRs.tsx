import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { getCurrentUser, getMyOpenPRs, getPRReviewData, type PRReviewData } from '../lib/github';
import { hasToken } from '../lib/tokens';
import PRList from '../components/PRList';
import { Link } from 'react-router-dom';

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

  const reviewsByPR = useMemo(() => {
    const map = new Map<string, PRReviewData>();
    prList.forEach((p, i) => {
      const data = reviewsQueries[i]?.data;
      if (data) map.set(`${p.repo}#${p.number}`, data);
    });
    return map;
  }, [prList, reviewsQueries]);

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

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">My Open PRs</h2>
      <PRList
        prs={prs.data ?? []}
        reviewsByPR={reviewsByPR}
        emptyMessage="No open PRs. 🎉"
      />
    </div>
  );
}
