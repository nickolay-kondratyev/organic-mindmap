#!/usr/bin/env bash
# Runs the library demo runner (Vite dev server in core/). Port: PORT env var (default 5173).
# Extra args are passed to vite, e.g. `./run.sh --open` or `./run.sh --host`.
set -euo pipefail

# Repo root: the npm workspace root that owns node_modules and the lockfile.
cd "$(dirname "${BASH_SOURCE[0]}")"

# Install deps on a fresh clone, or when the lockfile changed since the last install.
# [node_modules/.package-lock.json]: npm writes it on every install, so it is older than
# package-lock.json exactly when deps are out of date.
if [[ ! -f node_modules/.package-lock.json || package-lock.json -nt node_modules/.package-lock.json ]]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting demo on http://localhost:${PORT:-5173}"
exec npm run dev -- "$@"
