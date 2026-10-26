# Organic Mindmap (Obsidian plugin)

Mindmaps for [Obsidian](https://obsidian.md) that feel hand-drawn: organic branches, glyph-outline labels along
them, a tidy bilateral layout that does not look machine-made.

**Status: in development, not released.** Today the plugin only proves the plumbing (one command, "Show plugin
status"). First planned feature: a **mindmap note**, a normal Markdown note flagged `organic-mindmap: 1` whose nested
list is the tree, opened as a map, with `[[links]]` kept by Obsidian. Plan: [next-steps-prior-to-obsidian.md](next-steps-prior-to-obsidian.md).

Desktop only.

## Install from source (for now)

```bash
npm install
npm run build:plugin          # bundles obsidian-plugin/main.js
```

Copy `obsidian-plugin/main.js` and `manifest.json` into `<your vault>/.obsidian/plugins/organic-mindmap/`, then
enable "Organic Mindmap" under Settings > Community plugins. Or `npm run setup:dev-vault` and open
`obsidian-plugin/.dev-vault/` as a vault (the plugin is already installed there).

## Repo layout

npm workspaces monorepo:

| Package | Path | What |
|---|---|---|
| `organic-mindmap` | [`core/`](core/README.md) | The mindmap library (framework-free core + React wrapper), its demo and tests. Usable on its own; knows nothing about Obsidian. |
| plugin | `obsidian-plugin/` | The Obsidian plugin, built on the library's public API. Bundles to `obsidian-plugin/main.js`; `manifest.json` / `versions.json` live at the repo root (Obsidian's release flow). |

Requirements: [spec.md](spec.md). Architecture: [docs/architecture.md](docs/architecture.md).

## Develop

```bash
npm install                     # deps for both packages + Playwright Chromium
npm run typecheck && npm test   # both packages (Vitest unit tests)
npm run build                   # library to core/dist/ and plugin to obsidian-plugin/main.js
npm run build:plugin            # plugin only; `npm run dev:plugin` rebuilds on change
npm run e2e                     # library demo E2E (Playwright, Chromium)
npm run test:e2e:obsidian       # plugin E2E in a REAL Obsidian (see below)
```

### Plugin E2E in a real Obsidian

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
