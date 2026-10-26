Use typical best practices and idiomatic code.
Goal right now is to implement [spec.md](spec.md). Architecture and module seams: [docs/architecture.md](docs/architecture.md).

## Decided, not yet implemented (2026-10-26)
Delete each entry once it is implemented (the code and docs then carry it).
- **Mindmap file = one Markdown note** flagged by frontmatter `organic-mindmap: 1`: nested list = tree, block id
  (`^n7f3k`) = node id, links as `[[...]]` so Obsidian updates them, positions in a `%%`-hidden JSON block keyed by
  block id, each saved as an offset from its parent (not absolute). The format lives in the plugin; the library sees
  only `NodeId`s. Details: `next-steps-prior-to-obsidian.md` "Phase 1a".

## Layout
- npm workspaces monorepo. `core/` is the library package `organic-mindmap` (src, demo, tests, bench, configs,
  CHANGELOG). `obsidian-plugin/` is the Obsidian plugin (private package): depends on `organic-mindmap` and imports
  only its public entry (`organic-mindmap`, aliased to `core/src` by `obsidian-plugin/coreAlias.ts`); bundles to
  `obsidian-plugin/main.js`. `manifest.json` + `versions.json` stay at the repo root (Obsidian release flow). The
  root holds shared docs (`spec.md`, `docs/`, tickets) and a private workspace root.
- The library never imports `obsidian` (`core/src/noObsidianImports.test.ts`); the plugin never reaches core internals.

## Commands
Run from the repo root; `typecheck`, `test` and `build` cover both packages, the rest delegate to `core` (extra args after `--` are relative to the package).
- `npm install` — deps + Playwright Chromium (core's `prepare` script runs `core/scripts/install-browsers.mjs`, skipped when Chromium is present).
- `npm run typecheck` · `npm test` (Vitest, both packages) · `npm run build` (library to `core/dist/`, plugin to `obsidian-plugin/main.js`) · `npm run e2e` (demo Playwright) · `npm run coverage` (unit coverage to `core/coverage/`, no gate) · `npm run bench` (`buildScene` timings per map size, report only).
- Plugin: `npm run build:plugin` · `npm run dev:plugin` (watch) · `npm run setup:dev-vault` (seeds `obsidian-plugin/.dev-vault/` with the built plugin) · `npm run test:e2e:obsidian` (real-Obsidian Playwright E2E; downloads a pinned Obsidian once into `.tmp/obsidian-e2e/bin/`, headless without a display, `OBSIDIAN_PATH` to use your own binary; not part of `npm test`).
- `./run.sh` at the repo root (or `npm run dev`) — demo at `http://localhost:$PORT` (default 5173). `npm run build:demo && npm run preview` serves the built demo on `$E2E_PORT` (default 4173).

## Conventions
- Ports are env-driven so parallel checkouts do not collide: `PORT=5301 npm run dev`, `E2E_PORT=5311 npm run e2e`.
- `core/src/core/**` never imports React (a unit test enforces it). Demo/tests import `organic-mindmap` and `organic-mindmap/react` only.
- Settings persist through the host-implemented `SettingsStorage` seam (async `load`/`save`, e.g. Obsidian `loadData`/`saveData`); the library owns the settings and restores untrusted stored data over defaults. See docs/architecture.md "Settings storage".
- Tests: Vitest BDD (`describe` GIVEN, `it` WHEN/THEN), one behavior per test. Playwright only for key journeys, no look assertions except the one reference screenshot (`core/e2e/reference-view.spec.ts`, see docs/architecture.md "Acceptance screenshot"). Plugin logic is unit-tested in modules that do not import `obsidian`; Obsidian E2E specs (`obsidian-plugin/e2e/*.e2e.ts`) never import modules that do (see docs/architecture.md "Obsidian E2E").
- Tests never hit the network: E2E imports `test` from `core/e2e/fixtures.ts`; unit tests use `core/test-support/` (vendored font, synthetic curves).
- Redirect verbose output to `.tmp/` (git-ignored).
