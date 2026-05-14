import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, getReviewRequests } from '../lib/github';
import { hasToken } from '../lib/tokens';
import PRList from '../components/PRList';
import { Link } from 'react-router-dom';

export default function ReviewQueue() {
  const tokenSet = hasToken('github');

  const user = useQuery({
    queryKey: ['github-user'],
    queryFn: getCurrentUser,
    enabled: tokenSet,
  });

  const prs = useQuery({
    queryKey: ['review-queue', user.data?.login],
    queryFn: () => getReviewRequests(user.data!.login),
    enabled: tokenSet && Boolean(user.data?.login),
  });

  if (!tokenSet) {
    return (
      <div className="text-sm text-slate-500">
        Add your GitHub token in{' '}
        <Link to="/settings" className="underline">
          Settings
        </Link>{' '}
        to see your review queue.
      </div>
    );
  }

  if (prs.isLoading || user.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (prs.isError || user.isError) {
    return (
      <p className="text-sm text-red-600">
        Error: {(prs.error || user.error)?.message}
      </p>
    );
  }

  const sorted = [...(prs.data ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Review Queue</h2>
      <p className="text-sm text-slate-500 mb-4">
        PRs waiting for your review, oldest first.
      </p>
      <PRList prs={sorted} emptyMessage="No PRs waiting on your review." />
    </div>
  );
}
