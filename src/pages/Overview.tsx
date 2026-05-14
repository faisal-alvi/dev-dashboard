import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCurrentUser, getMyOpenPRs, getReviewRequests } from '../lib/github';
import { hasToken } from '../lib/tokens';

function Stat({ label, value, to }: { label: string; value: string | number; to: string }) {
  return (
    <Link
      to={to}
      className="block p-5 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
    >
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </Link>
  );
}

export default function Overview() {
  const tokenSet = hasToken('github');

  const user = useQuery({
    queryKey: ['github-user'],
    queryFn: getCurrentUser,
    enabled: tokenSet,
  });

  const myPRs = useQuery({
    queryKey: ['my-prs', user.data?.login],
    queryFn: () => getMyOpenPRs(user.data!.login),
    enabled: tokenSet && Boolean(user.data?.login),
  });

  const reviews = useQuery({
    queryKey: ['review-queue', user.data?.login],
    queryFn: () => getReviewRequests(user.data!.login),
    enabled: tokenSet && Boolean(user.data?.login),
  });

  if (!tokenSet) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-2">Welcome</h2>
        <p className="text-sm text-slate-500 mb-4">
          Add your tokens in Settings to start.
        </p>
        <Link
          to="/settings"
          className="inline-block px-4 py-2 text-sm rounded bg-slate-900 text-white hover:bg-slate-700"
        >
          Open Settings
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {user.data ? `Hi ${user.data.name || user.data.login}` : 'Overview'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Stat
          label="Open PRs you authored"
          value={myPRs.isLoading ? '…' : myPRs.data?.length ?? 0}
          to="/my-prs"
        />
        <Stat
          label="PRs waiting on your review"
          value={reviews.isLoading ? '…' : reviews.data?.length ?? 0}
          to="/review-queue"
        />
      </div>
    </div>
  );
}
