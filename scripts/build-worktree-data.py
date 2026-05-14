#!/usr/bin/env python3
"""
Build public/worktree-data.json by scanning every plugin's .claude/worktrees/.

Run from anywhere — paths are resolved relative to the dashboard repo root.

This script is the source of truth for the JSON schema served at
https://faisal-alvi.github.io/dev-dashboard/worktree-data.json.

It collects:
- Per worktree: ticket, title, status, next_action, branch, github_repo,
  pr_url, review_status, git state (counts + files + commit log),
  last_activity, pr_template (override).
- Per plugin: pr_template (fallback).
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

GIT = '/usr/bin/git'

# Resolve the plugins root from this script's location.
SCRIPT_DIR = Path(__file__).resolve().parent
DASHBOARD_ROOT = SCRIPT_DIR.parent
PLUGINS_ROOT = DASHBOARD_ROOT.parent

DASHBOARD_NAME = DASHBOARD_ROOT.name  # 'DEV-DASHBOARD'


def run_git(path, *args):
    try:
        r = subprocess.run(
            [GIT, '-C', str(path), *args],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return r.stdout.rstrip('\n') if r.returncode == 0 else None
    except Exception:
        return None


def read_file(path):
    try:
        return path.read_text(encoding='utf-8') if path.exists() else None
    except Exception:
        return None


def extract_status(content):
    """Look for 'Current status: ...' or '**Status:** ...' lines."""
    if not content:
        return None
    for line in content.splitlines():
        m = re.match(
            r'\s*(?:\*\*)?(?:Current\s+)?[Ss]tatus(?:\*\*)?:\s*(.*?)\s*$',
            line,
        )
        if m:
            val = re.sub(r'\*\*$', '', m.group(1)).strip()
            if val:
                return val[:100]
    return None


def extract_title(content):
    """First non-empty, non-heading line, truncated."""
    if not content:
        return None
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('---'):
            continue
        return line[:120]
    return None


def extract_next_action(content):
    """Look for a 'Next action' header, then the first bullet/sentence under it."""
    if not content:
        return None
    in_next = False
    for line in content.splitlines():
        if in_next:
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith('#'):
                break
            clean = re.sub(r'^[-*\s]+', '', stripped)
            clean = re.sub(r'^\d+\.\s*', '', clean)
            return clean[:200] if clean else None
        if re.search(r'[Nn]ext\s+[Aa]ction', line):
            in_next = True
    return None


def extract_pr_url(content):
    if not content:
        return None
    m = re.search(r'https://github\.com/[^\s)]+/pull/\d+', content)
    return m.group(0) if m else None


def extract_last_activity(content):
    """First '## YYYY-MM-DD' heading in changelog."""
    if not content:
        return None
    m = re.search(r'^##\s+(\d{4}-\d{2}-\d{2})', content, re.MULTILINE)
    return m.group(1) if m else None


def extract_review_status(content):
    if not content:
        return None
    m = re.search(r'^\*\*Status:\*\*\s*(.+?)\s*$', content, re.MULTILINE)
    return m.group(1) if m else None


def extract_github_repo(path):
    url = run_git(path, 'config', '--get', 'remote.origin.url')
    if not url:
        return None
    m = re.search(r'github\.com[:/](.+?)(?:\.git)?$', url)
    return m.group(1) if m else None


def first_existing(*paths):
    for p in paths:
        if p.exists():
            try:
                return p.read_text(encoding='utf-8')
            except Exception:
                continue
    return None


def get_git_state(path):
    status_out = run_git(path, 'status', '--short') or ''
    staged = modified = untracked = 0
    files = []
    for line in status_out.splitlines():
        if not line:
            continue
        s = line[:2]
        name = line[3:].strip()
        if name.startswith('"') and name.endswith('"'):
            name = name[1:-1]
        files.append({'status': s, 'path': name})
        if s.startswith('??'):
            untracked += 1
        else:
            if s[0] in 'MADRC':
                staged += 1
            if len(s) > 1 and s[1] in 'MD':
                modified += 1
    try:
        ahead = int(run_git(path, 'rev-list', '--count', 'origin/trunk..HEAD') or '0')
    except (TypeError, ValueError):
        ahead = 0
    try:
        behind = int(run_git(path, 'rev-list', '--count', 'HEAD..origin/trunk') or '0')
    except (TypeError, ValueError):
        behind = 0
    commits = []
    log = run_git(path, 'log', '--format=%H%x1f%ai%x1f%s%x1f%an', '-n', '10')
    if log:
        for line in log.splitlines():
            parts = line.split('\x1f', 3)
            if len(parts) == 4:
                commits.append({
                    'sha': parts[0][:7],
                    'date': parts[1],
                    'message': parts[2],
                    'author': parts[3],
                })
    return {
        'staged': staged,
        'modified': modified,
        'untracked': untracked,
        'ahead': ahead,
        'behind': behind,
        'files': files[:50],  # cap to keep payload small
        'recent_commits': commits,
    }


def collect_plugin(plugin_dir):
    worktrees_dir = plugin_dir / '.claude' / 'worktrees'
    if not worktrees_dir.is_dir():
        return None

    plugin_template = first_existing(
        plugin_dir / '.claude' / 'docs' / 'pr-template.md',
        plugin_dir / '.github' / 'PULL_REQUEST_TEMPLATE.md',
        plugin_dir / '.github' / 'pull_request_template.md',
        plugin_dir / 'PULL_REQUEST_TEMPLATE.md',
    )

    worktrees = []
    for wt_dir in sorted(worktrees_dir.iterdir()):
        if not wt_dir.is_dir():
            continue
        ticket = wt_dir.name
        docs = wt_dir / '.claude' / 'docs'

        worktrees.append({
            'ticket': ticket,
            'title': extract_title(read_file(docs / f'{ticket}.md')),
            'status': extract_status(read_file(docs / 'status.md')),
            'next_action': extract_next_action(read_file(docs / 'status.md')),
            'branch': run_git(wt_dir, 'rev-parse', '--abbrev-ref', 'HEAD') or 'unknown',
            'github_repo': extract_github_repo(wt_dir),
            'pr_url': extract_pr_url(read_file(docs / 'status.md')),
            'review_status': extract_review_status(
                read_file(docs / f'{ticket}-review.md')
            ),
            'git': get_git_state(wt_dir),
            'last_activity': extract_last_activity(read_file(docs / 'changelog.md')),
            'pr_template': first_existing(docs / 'pr-template.md'),
        })

    if not worktrees:
        return None

    return {
        'name': plugin_dir.name,
        'pr_template': plugin_template,
        'worktrees': worktrees,
    }


def main():
    plugins = []
    for plugin_dir in sorted(PLUGINS_ROOT.iterdir()):
        if not plugin_dir.is_dir() or plugin_dir.name == DASHBOARD_NAME:
            continue
        if plugin_dir.name.startswith('.'):
            continue
        result = collect_plugin(plugin_dir)
        if result:
            plugins.append(result)

    data = {
        'generated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'plugins': plugins,
    }

    output = DASHBOARD_ROOT / 'public' / 'worktree-data.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    total = sum(len(p['worktrees']) for p in plugins)
    print(f'Wrote {output}')
    print(f'Stats: {total} worktrees across {len(plugins)} plugins')


if __name__ == '__main__':
    main()
