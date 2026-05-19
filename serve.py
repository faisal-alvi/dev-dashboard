#!/usr/bin/env python3
"""SPA-aware static server for the dev dashboard.
Serves files from dist/; falls back to index.html for unknown paths (React Router)."""

import os, sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

DIST = os.path.join(os.path.dirname(__file__), 'dist')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5000

os.chdir(DIST)

class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # If the requested path is not an existing file, serve index.html
        local = self.translate_path(self.path)
        if not os.path.isfile(local):
            self.path = '/index.html'
        super().do_GET()

    def log_message(self, fmt, *args):
        pass  # silence request logs

print(f'Dev Dashboard  →  http://localhost:{PORT}/worktrees')
HTTPServer(('127.0.0.1', PORT), SPAHandler).serve_forever()
