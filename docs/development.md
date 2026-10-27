# Development

Requirements: [spec.md](../spec.md). Architecture: [architecture.md](architecture.md). User docs: [README](../README.md).

## Repo layout

npm workspaces monorepo:

| Package | Path | What |
|---|---|---|
| `organic-mindmap` | [`core/`](../core/README.md) | The mindmap library (framework-free core + React wrapper), its demo and tests. Usable on its own; knows nothing about Obsidian. |
| plugin | `obsidian-plugin/` | The Obsidian plugin, built on the library's public API. Bundles to `main.js` at the repo root; the repo root is the plugin folder (`main.js`, `manifest.json`, `styles.css`, `versions.json`). |

## Commands

```bash
npm install                     # deps for both packages + Playwright Chromium
npm run typecheck && npm test   # both packages (Vitest unit tests)
npm run build                   # library to core/dist/ and plugin to main.js at the repo root
npm run build:plugin            # plugin only; `npm run dev:plugin` rebuilds on change
npm run e2e                     # library demo E2E (Playwright, Chromium)
npm run test:e2e:obsidian       # plugin E2E in a REAL Obsidian (see below)
```

`npm run dev:plugin` rebuilds `main.js` on every source change; reload the plugin in Obsidian to pick it up. Or
`npm run setup:dev-vault` and open `obsidian-plugin/.dev-vault/` as a vault (the plugin is already installed there).

## Plugin E2E in a real Obsidian

`npm run test:e2e:obsidian` builds the plugin, seeds `obsidian-plugin/.dev-vault/`, boots a real Obsidian (Electron)
on a throwaway copy of that vault and drives it with Playwright over CDP. Not part of `npm test` (slow; a release
gate). Runs headless on a display-less Linux box: the first run downloads a pinned Obsidian (`OBSIDIAN_VERSION` in
`obsidian-plugin/scripts/setup-obsidian-bin.sh`) into git-ignored `.tmp/obsidian-e2e/bin/`.

```bash
npm run test:e2e:obsidian                       # Linux: downloads Obsidian once, headless if no display
npm run test:e2e:obsidian -- smoke.e2e.ts        # one spec
OBSIDIAN_PATH='/Applications/Obsidian.app/Contents/MacOS/Obsidian' npm run test:e2e:obsidian   # macOS / your own binary
```

Env: `OBSIDIAN_PATH` (use this binary, skips the download), `OBSIDIAN_VERSION` (download another build for one run),
`OBSIDIAN_CACHE_DIR` (share one download across checkouts), `OBSIDIAN_E2E_EXTRA_ARGS` (Chromium flags; defaults to
headless flags when no display).

## Releasing the plugin

Plugin versions are bare `x.y.z` git tags (Obsidian forbids a `v` prefix); the root `package.json` version is the
plugin version. The library in `core/` keeps its own `vX.Y.Z` tags (`core/CHANGELOG.md`), which do not trigger a
plugin release.

```bash
./release.sh 0.1.0                       # first release: files already at 0.1.0, just tag
./release.sh patch|minor|major           # later: bump, commit, tag
gh run watch                             # the tag push runs .github/workflows/release.yml
scripts/verify-release.sh <version>      # download the release, check attestation + SHA256SUMS
```

`./release.sh` (a thin wrapper over `scripts/release.sh`) needs a clean tree and refuses to tag unless typecheck,
build, unit tests and the real-Obsidian E2E pass.
`npm version` runs `version-bump.mjs`, which copies the version into `manifest.json` and adds it to `versions.json`
with the current `minAppVersion`. The workflow builds `main.js`, checks the tag equals the `manifest.json` version, and
publishes `main.js`, `manifest.json`, `styles.css` and `SHA256SUMS` with build-provenance attestation as the latest
release. To redo a tag, delete its GitHub release first: the workflow fails if the release exists.

One-time: GitHub repo Settings > Actions > General > Workflow permissions > "Read and write permissions".
