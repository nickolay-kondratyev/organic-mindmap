---
closed_iso: 2026-10-26T22:00:00Z
id: nid_jhuq7jgjalnz6mv72937ivl1k_e
title: "Decide: how should the Obsidian plugin install this library (tag has no built files)?"
status: closed
deps: []
links: [nid_rk795rjqzzksdjrhm03dy6s7l_e]
created_iso: 2026-10-23T20:47:27Z
status_updated_iso: 2026-10-26T22:00:00Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [obsidian-heading-launch, decide, need-human]
---

## Problem (plain terms)

The v0.2.0 release marks a git tag the Obsidian plugin can depend on. But installing the library straight from git (`npm install git+...#v0.2.0`) gives a package with **no built code**: `dist/` is git-ignored and nothing builds it on install. Found while doing ticket `nid_bjzc14tu7h3d3fjknqyfk17r5_e` (tested with `npm install git+file://...` in a scratch project: only `LICENSE.md`, `README.md`, `package.json` arrived).

npm publishing is a non-goal of epic `nid_rk795rjqzzksdjrhm03dy6s7l_e`.

## Options

- **A. Build on install.** `prepare` in `package.json` also runs `npm run build`. The plugin repo must approve the install script once (newer npm blocks install scripts by default), and the Playwright browser step in `scripts/install-browsers.mjs` must skip itself outside this repo.
- **B. Commit `dist/` on release commits only.** Easiest for the plugin; built files live in git and go stale on main between releases.
- **C. No change here.** The plugin uses `npm pack` output (a .tgz) or a local `file:` path to this repo until we publish to npm.

## Recommendation

**C** for the first plugin work: no change, nothing fragile. Revisit (A or npm publish) once the API settles.

## Done when

The human picks an option; if A or B, that work is done here and the plugin can install the tagged version.


## Notes

**2026-10-23T20:49:15Z**

Reviewer finding: npm DOES run `prepare` when installing a git dependency, so a plugin depending on the tag would also run `scripts/install-browsers.mjs` (may download Chromium) and still get no dist/. README line about prepare running in "dev checkouts only" is wrong for git deps. Reviewer recommends option A with the browser install moved out of `prepare` into a separate dev step. Orchestrator still recommends C for now (plugin uses npm pack / file: path), with that README line fixed as part of whichever option is picked.

**2026-10-26** Decided (human): moot. This repo becomes the Obsidian plugin; the plugin package depends on the library
package through npm workspaces, so no git tag install is needed (see CLAUDE.md "Decided, not yet implemented").
