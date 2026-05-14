import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import MyPRs from './pages/MyPRs';
import ReviewQueue from './pages/ReviewQueue';
import Worktrees from './pages/Worktrees';
import Time from './pages/Time';
import QuickStart from './pages/QuickStart';
import Settings from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="my-prs" element={<MyPRs />} />
            <Route path="review-queue" element={<ReviewQueue />} />
            <Route path="worktrees" element={<Worktrees />} />
            <Route path="time" element={<Time />} />
            <Route path="quick-start" element={<QuickStart />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
