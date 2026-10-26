Use typical best practices and idiomatic code.
Goal right now is to implement [spec.md](spec.md). Architecture and module seams: [docs/architecture.md](docs/architecture.md).

## Decided, not yet implemented (2026-10-26)
Delete each entry once it is implemented (the code and docs then carry it).
- **This repo becomes the Obsidian plugin.** No separate plugin repo. Name: `organic-mindmap` everywhere (new repo,
  plugin id, file flag); the library package name follows it when it moves. Epic/tickets wait for the new repo.
- **Library and plugin stay separate packages** (npm workspaces): the library (today's `src/`, demo, its tests) moves to
  its own package and keeps its own tests; a new `plugin` package depends on it like any dependency and imports only its
  public entry points. The library never imports `obsidian`. Obsidian releases need `manifest.json` at the repo root.
- **Mindmap file = one Markdown note** flagged by frontmatter `organic-mindmap: 1`: nested list = tree, block id
  (`^n7f3k`) = node id, links as `[[...]]` so Obsidian updates them, positions in a `%%`-hidden JSON block keyed by
  block id, each saved as an offset from its parent (not absolute). The format lives in the plugin; the library sees
  only `NodeId`s. Details: `next-steps-prior-to-obsidian.md` "Phase 1a".

## Commands
- `npm install` — deps + Playwright Chromium (the `prepare` script runs `scripts/install-browsers.mjs`, skipped when Chromium is present).
- `npm run typecheck` · `npm test` (Vitest) · `npm run build` (library to `dist/`) · `npm run e2e` (Playwright) · `npm run coverage` (unit coverage to `coverage/`, no gate) · `npm run bench` (`buildScene` timings per map size, report only).
- `./run.sh` (or `npm run dev`) — demo at `http://localhost:$PORT` (default 5173). `npm run build:demo && npm run preview` serves the built demo on `$E2E_PORT` (default 4173).

## Conventions
- Ports are env-driven so parallel checkouts do not collide: `PORT=5301 npm run dev`, `E2E_PORT=5311 npm run e2e`.
- `src/core/**` never imports React (a unit test enforces it). Demo/tests import `organic-mindmap` and `organic-mindmap/react` only.
- Settings persist through the host-implemented `SettingsStorage` seam (async `load`/`save`, e.g. Obsidian `loadData`/`saveData`); the library owns the settings and restores untrusted stored data over defaults. See docs/architecture.md "Settings storage".
- Tests: Vitest BDD (`describe` GIVEN, `it` WHEN/THEN), one behavior per test. Playwright only for key journeys, no look assertions except the one reference screenshot (`e2e/reference-view.spec.ts`, see docs/architecture.md "Acceptance screenshot").
- Tests never hit the network: E2E imports `test` from `e2e/fixtures.ts`; unit tests use `test-support/` (vendored font, synthetic curves).
- Redirect verbose output to `.tmp/` (git-ignored).
