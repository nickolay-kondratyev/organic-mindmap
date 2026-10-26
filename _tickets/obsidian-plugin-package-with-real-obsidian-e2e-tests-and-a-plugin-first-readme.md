---
closed_iso: 2026-10-26T22:49:35Z
id: nid_eqq17z13ui62faww955vkjdjp_e
title: "Obsidian plugin package with real-Obsidian E2E tests and a plugin-first README"
status: closed
deps: [nid_b83apppr45lbst30ia592ohg0_e]
links: []
created_iso: 2026-10-26T22:25:00Z
status_updated_iso: 2026-10-26T22:49:35Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
parent: nid_h4bhoi9jvbh3zny2ldnuxb0sq_e
profile: higher
tags: [obsidian-mindmap-file]
---

## Goal
Add the Obsidian plugin as a second workspace package, `obsidian-plugin/`, with the whole test pyramid working
from day one: fast unit tests (Vitest) for plugin logic and a real-Obsidian (Electron) Playwright E2E suite for key
journeys. Later plugin tickets only add features and tests, never test plumbing. The README becomes plugin-first,
because this is the repo people will find for the plugin.

## Done criteria
- `obsidian-plugin/` is a private workspace package that depends on `organic-mindmap` (the `core/` workspace) and
  imports only its public entry point(s). It bundles to `main.js` (esbuild, Obsidian's usual setup); React is not
  bundled (the plugin uses `mountMindmap` from the core entry).
- `manifest.json` (plugin id `organic-mindmap`, name "Organic Mindmap", `isDesktopOnly: true`) and `versions.json`
  live at the **repo root** (Obsidian's release flow reads them there), with one source of truth for the manifest.
- A minimal plugin loads in Obsidian: e.g. registers one command; no mindmap features yet.
- `npm run test:e2e:obsidian` (name may differ; document it) from a display-less Linux box downloads a pinned
  Obsidian once (cached), runs headless, and passes a smoke spec that proves the plugin is enabled and its command
  is registered. It also runs on a dev machine with `OBSIDIAN_PATH`.
- Root `npm test` and `npm run typecheck` cover both packages; the Obsidian E2E suite stays out of `npm test`
  (release gate, slow). The existing demo E2E (`npm run e2e`) keeps working.
- A unit test fails if anything under `core/` imports `obsidian` (like `core/src/core/noReactImports.test.ts`).
- `README.md` (root) is plugin-first: what Organic Mindmap is for Obsidian users, status (in development), how to
  install from source for now, dev commands for both packages. The library's usage docs (today's README "Use" and
  "Demo runner" sections) move to `core/README.md`, linked from the root README. Parallel library tickets
  (`nid_iexvo4oqwq038twvy9od9gm2b_e`, `nid_89ap39gl425o98g5qnhkuszdl_e`) may have added to the root README's
  "Use" section meanwhile; carry their text along when you move it (merge conflicts here are expected).
- `CLAUDE.md` Commands lists the plugin commands; "Decided, not yet implemented" loses the parts this ticket
  implements. `docs/architecture.md` gets a short "Packages" section (core vs plugin, the dependency direction).

## Context
- Load the `obsidian-add-e2e` skill and `${MY_DEEP_MEM}/obsidian-how-to-setup-e2e-test.md` before building the E2E
  harness; it lists the mechanics that must not be simplified away (CDP attach, `.tar.gz` not AppImage, pinned
  version, isolated user-data-dir, headless flags, window-size seeding, fresh vault copy, runtime plugin enable).
- This machine has no `$DISPLAY`; GitHub release downloads work. Download caches and scratch go to git-ignored
  `.tmp/`; never commit the Obsidian binary or the dev vault's built plugin files.
- Tests never hit the network (`CLAUDE.md`); the one-time Obsidian download is a setup step, like the Playwright
  Chromium install in `core/scripts/install-browsers.mjs`.
- Decisions: `CLAUDE.md` "Decided, not yet implemented"; mindmap-file format: `next-steps-prior-to-obsidian.md`
  "Phase 1a" (implemented by later tickets).

## Constraints
- `core/package.json` points at `dist/` (`main`, `exports`), so the plugin only sees a **built** core: root
  scripts build `core` before the plugin's typecheck/bundle (or the plugin aliases `organic-mindmap` to
  `core/src` the way `core/tsconfig.json` `paths` does). Pick one, keep `npm run build` from a fresh clone working.
- Spec files and the E2E harness must never import plugin modules that import `obsidian` (types-only package).
- E2E covers key journeys only, with no look assertions; logic goes into unit tests.

## Non-goals
- Any mindmap feature in the plugin (later tickets), settings tab, mobile support, CI workflow, community-plugin
  submission.
