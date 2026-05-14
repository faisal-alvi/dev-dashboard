import { NavLink, Outlet } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
  end?: boolean;
  icon: string;
}

const tabs: Tab[] = [
  { to: '/', label: 'Overview', end: true, icon: '🏠' },
  { to: '/worktrees', label: 'Worktrees', icon: '🌿' },
  { to: '/my-prs', label: 'My PRs', icon: '📤' },
  { to: '/review-queue', label: 'Review Queue', icon: '📥' },
  { to: '/time', label: 'Time', icon: '⏱️' },
  { to: '/quick-start', label: 'Quick Start', icon: '▶️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <aside className="w-56 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-base font-semibold tracking-tight">Dev Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Personal · private data</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          <a
            href="https://github.com/faisal-alvi/dev-dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            github.com/.../dev-dashboard
          </a>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
