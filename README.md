# Dev Dashboard

A personal dashboard for tracking GitHub PRs, review queues, and (eventually) Teamwork hours and local worktree state. All data stays in your browser.

**Live:** https://faisal-alvi.github.io/dev-dashboard/

## How it works

- Static SPA hosted on GitHub Pages
- Tokens stored in `localStorage` only — never leave your machine
- All API calls happen browser → API directly (no server)
- Public code, private data

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173/dev-dashboard/.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow that builds and deploys to Pages.
