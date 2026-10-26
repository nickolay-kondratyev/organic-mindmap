---
id: nid_b83apppr45lbst30ia592ohg0_e
title: "[SOLO] Monorepo: move the library into core/ as package organic-mindmap"
status: in_progress
deps: []
links: []
created_iso: 2026-10-26T22:25:00Z
status_updated_iso: 2026-10-26T22:32:16Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
parent: nid_h4bhoi9jvbh3zny2ldnuxb0sq_e
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_organic-mindmap/.worktree/t-b83apppr
tags: [obsidian-mindmap-file, solo]
---

## Goal
Turn the repo into an npm workspaces monorepo so the Obsidian plugin can sit next to the library as a separate
package. The library (code, demo, its unit/E2E tests, bench, configs) moves into `core/` and is renamed from
`natural-mindmap` to `organic-mindmap`. No behavior change: same tests, same results, just a new home.

## Done criteria
- Root `package.json` is a private workspace root (`"workspaces": ["core"]`, the plugin is added by
  `nid_eqq17z13ui62faww955vkjdjp_e`); one root `package-lock.json`.
- `core/package.json` is the library package `organic-mindmap` with entry points `organic-mindmap` and
  `organic-mindmap/react`; no `natural-mindmap` left in code, configs, tests or docs (grep is clean, except
  history: `CHANGELOG.md`, `_tickets/`, `_change_log/`, `_agent_decisions/`).
- From the repo root: `npm install`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` (demo
  Playwright suite incl. the reference screenshot), `npm run bench`, `npm run coverage` and `./run.sh` all work
  and delegate to `core`. Unit + E2E pass counts equal the counts before the move (state both in the commit/return).
- The same commands also work from inside `core/`.
- `CLAUDE.md` (Commands, Conventions), `docs/architecture.md`, `README.md` dev section and `.gitignore` reflect the
  new paths. In `CLAUDE.md` "Decided, not yet implemented", remove only what this ticket implements (the
  library-as-its-own-package part); keep the plugin parts.
- `next-steps-prior-to-obsidian.md` no longer contradicts the epic: its intro and decision 12 say the mindmap file
  comes **before** the heading map (human, 2026-10-26), and "the `plugin` package" reads `obsidian-plugin/`.
- The reference screenshot baseline still matches without regeneration (moving it is fine, re-recording it is not).

## Context
- Current layout: `src/`, `demo/`, `e2e/`, `bench/`, `test-support/`, `assets/` (vendored Kalam font, used by
  `test-support/vendoredKalam.ts`), `scripts/install-browsers.mjs`, `run.sh`, `vite.config.ts`,
  `vite.lib.config.ts`, `vite.shared.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig*.json`.
- Hardcoded paths to update: `vite.shared.ts` (aliases), `vite.config.ts` (`../dist-demo`, html inputs),
  `tsconfig.json` (`paths` for `natural-mindmap`, `include`), `bench/vitest.bench.config.ts`, `playwright.config.ts`
  (`webServer` runs `npm run build:demo && npm run preview`), `run.sh` (checks `node_modules` next to itself).
- `src/core/interaction/reparentDialog.ts` builds DOM ids with the `natural-mindmap-` prefix; rename them too.
- Stay at repo root (shared by both packages): `spec.md`, `docs/`, `next-steps-prior-to-obsidian.md`, `_tickets/`,
  `_change_log/`, `_agent_decisions/`, `CLAUDE.md`, `LICENSE.md`, `README.md`. `CHANGELOG.md` is the library's and
  moves to `core/` (add an entry for the rename).
- Decisions: `CLAUDE.md` "Decided, not yet implemented".

## Constraints
- Solo ticket: it touches nearly every file, so no other lane runs while it is in progress.
- Use `git mv` so history follows the files.
- Ports stay env-driven (`PORT`, `E2E_PORT`).

## Non-goals
- The Obsidian plugin package (next ticket).
- Any library behavior or API change; publishing to npm.
