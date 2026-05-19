#!/bin/bash
# Open the dev dashboard locally — no npm needed at runtime.
# First-time only: source ~/.nvm/nvm.sh && nvm use 20 && npm run build:local

DASHBOARD_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST="$DASHBOARD_DIR/dist"
PORT=5000

if [ ! -d "$DIST" ]; then
  echo "dist/ not found. Building once..."
  source ~/.nvm/nvm.sh 2>/dev/null
  nvm use 20 --silent 2>/dev/null
  cd "$DASHBOARD_DIR" && npm run build:local
fi

open "http://localhost:$PORT/worktrees" 2>/dev/null || true
exec python3 "$DASHBOARD_DIR/serve.py" $PORT
