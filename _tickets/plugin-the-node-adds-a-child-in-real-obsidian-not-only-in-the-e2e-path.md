---
id: nid_76v6o4a80srw0tqec4ljx2hqw_e
title: "Plugin: the node '+' adds a child in real Obsidian (not only in the E2E path)"
status: in_progress
deps: []
links: []
created_iso: 2026-10-27T00:00:08Z
status_updated_iso: 2026-10-27T00:00:56Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_organic-mindmap/.worktree/t-76v6o4a8
tags: [mindmap-editing]
profile: higher
---

## Goal
The human reports (2026-10-26): in their own Obsidian, a mindmap note created with "Create new mindmap" opens as a map,
but clicking the "+" on a node does nothing. Adding nodes is the core editing action, so it must work for a real
person, not only for the scripted E2E path. Find the root cause, fix it (library `core/` or plugin, wherever the cause
is), and lock it with a test that fails without the fix.

## Done criteria
- Root cause named in the commit message and as a WHY comment at the fix, with the evidence that proves it (a test
  that failed before the fix and passes after, or a logged observation from a real Obsidian run).
- In the real-Obsidian E2E (`npm run test:e2e:obsidian`), adding a child works through the path a person takes:
  hover a node, click its "+", type a label, press Enter -> the note text contains the new item AND the map shows it.
  Cover a non-root node too (e.g. add a grandchild via the "+" of the child added before), since today only the
  root's "+" is tested.
- The new or tightened test fails on `main` for the root-caused reason (state in the report how you saw it fail).
- `npm run typecheck`, `npm test` green; demo E2E specs touched by a library change green.

## Context
- Already ruled out by the orchestrator on `main` (commit 0ce5660): the existing E2E
  `obsidian-plugin/e2e/mindmapNote.e2e.ts` "WHEN a child is added on the map via the root's "+"" PASSES headless at
  1280x800, and also with `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu --force-device-scale-factor=2"`
  (Retina-like pixel density). So the bug lives in something the test does not do the way a person does.
- That test moves the pointer in 10 px steps, clicks, then uses Playwright `fill` on the textbox (which focuses the
  input itself) and checks only the file text. Gaps worth checking, ranked by how cheap they are to disprove:
  1. Focus: the inline editor (`core/src/core/interaction/inlineLabelEditor.ts`) opens on `pointerup` and COMMITS on
     `blur`; an empty label is dropped (`openAddDraft` in `core/src/core/interaction/canvasInteractions.ts`). If
     Obsidian (or the following `mouseup`/`click`, workspace leaf activation, or the canvas keeping focus after
     `setPointerCapture`) moves focus away right after opening, the editor closes instantly with an empty label =
     "nothing happens". `fill` would hide this. Check `document.activeElement` after a plain click and type with
     `page.keyboard.type` instead of `fill`.
  2. Hit test vs what is drawn: the "+" position comes from `core/src/core/interaction/hitTest.ts` and the overlay
     placement from `core/src/core/interaction/canvasOverlayElement.ts` (`offsetLeft/Top` against the nearest
     positioned ancestor; `styles.css` at the repo root makes `.organic-mindmap-view` relative). Different pane
     sizes, sidebars open, a view that is not the first leaf, zoomed map, or a fast pointer path may differ.
  3. Stale build in the human's vault: the repo root is the plugin folder (`main.js`, `manifest.json`, `styles.css`
     at the root since 0ce5660). Rule out by running the current build, but do not stop there.
- The view: `obsidian-plugin/src/mapView/MindmapNoteView.ts` (mounts `mountMindmap`, writes edits via
  `MindmapNoteSession` in `obsidian-plugin/src/mapView/noteSession.ts`). Demo equivalent works: `core/e2e/interactions.spec.ts`.
- E2E harness: `obsidian-plugin/e2e/obsidianHarness.ts`; extra Electron flags via `OBSIDIAN_E2E_EXTRA_ARGS`
  (`obsidian-plugin/scripts/run-e2e.sh`). Deep memory `${MY_DEEP_MEM}/obsidian-how-to-setup-e2e-test.md` covers the setup.
- Conventions: `CLAUDE.md` (Vitest BDD, logic in unit tests, E2E only key journeys, no look assertions).

## Constraints
- Fix the root cause, not the symptom: no retries, timeouts, or "re-focus later" hacks without a mechanism that
  explains the evidence.
- If you cannot reproduce or prove a cause, STOP and report what you tried and what you observed (do not ship a
  speculative fix). The orchestrator will ask the human for details from their machine.

## Non-goals
- New editing features (keyboard shortcuts to add, Tab/Enter to add siblings).
- Move and delete coverage: ticket nid_0v1xv98rj4u0fertn6uxlhbeg_e.
