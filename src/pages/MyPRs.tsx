import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, getMyOpenPRs } from '../lib/github';
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
        emptyMessage="No open PRs. 🎉"
      />
    </div>
  );
}
