#!/usr/bin/env bash
# Cuts a plugin release: `./release.sh patch|minor|major|x.y.z`. Entry point next to run.sh; the logic lives in
# scripts/release.sh (gates, bump, tag, push).
set -euo pipefail

exec "$(dirname "${BASH_SOURCE[0]}")/scripts/release.sh" "$@"
