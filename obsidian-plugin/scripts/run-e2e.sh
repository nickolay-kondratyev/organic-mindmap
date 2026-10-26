#!/usr/bin/env bash
# Entry point for the real-Obsidian e2e suite (`npm run test:e2e` here, `npm run test:e2e:obsidian` at the root).
#
# Ensures a real Obsidian binary is available before running: when OBSIDIAN_PATH is
# unset it auto-downloads a pinned build via setup-obsidian-bin.sh (Linux); an
# already-set OBSIDIAN_PATH is honoured untouched. Then seeds the dev vault,
# type-checks the specs, and runs Playwright. Extra args pass through, e.g.
#   npm run test:e2e -- smoke.e2e.ts
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PLUGIN_ROOT}"

if [[ -z "${OBSIDIAN_PATH:-}" ]]; then
	OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)"
	export OBSIDIAN_PATH
fi

# Headless environments (containers / CI) have no display server, so Electron must
# render via Chromium's offscreen Ozone backend or it dies on boot ("Missing X
# server or $DISPLAY"). Default those flags when NO display is detected; an
# explicit OBSIDIAN_E2E_EXTRA_ARGS always wins (override for a real/GPU display).
if [[ -z "${OBSIDIAN_E2E_EXTRA_ARGS:-}" && -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
	export OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"
	echo "run-e2e: no display detected, using headless Obsidian flags: ${OBSIDIAN_E2E_EXTRA_ARGS}" >&2
fi

npm run setup:dev-vault
npx tsc --noEmit -p tsconfig.json
exec npx playwright test --config e2e/playwright.config.ts "$@"
