---
closed_iso: 2026-10-26T23:42:24Z
id: nid_48incacjmuach0kymaasz36du_e
title: "Plugin: map view keeps the right note when the tab switches mid-save; E2E covers delete + undo"
status: closed
deps: []
links: [nid_h4bhoi9jvbh3zny2ldnuxb0sq_e]
created_iso: 2026-10-26T23:34:38Z
status_updated_iso: 2026-10-26T23:42:24Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [obsidian-mindmap-file]
---

## Goal
Two gaps found while reviewing the last ticket of epic `nid_h4bhoi9jvbh3zny2ldnuxb0sq_e`:
1. If the map tab switches to another note while a write (edit or position save) is still in flight, the write's
   result can be loaded into the view's session for the **new** note: the map shows the wrong content until the
   next re-read. Writes themselves are safe (stale check), but what the user sees is wrong.
2. Delete + Undo is destructive and its view wiring (Obsidian `Menu`, the Undo `Notice`) has no committed test;
   only the session logic is unit-tested.

## Done criteria
- A write that completes after the view switched files (or unmounted) does not change the view's session or map.
  Covered by a unit test at the seam where the decision is made (pull it into a plain module if it is not yet
  testable without `obsidian`).
- The existing Obsidian E2E journey file `obsidian-plugin/e2e/mindmapNote.e2e.ts` gains one journey: right-click a
  node -> Delete -> the item is gone from the file -> Undo -> the file text equals the text before the delete.
  No look assertions.
- Full `npm test` and `npm run test:e2e:obsidian` pass (twice for E2E).

## Context
- View: `obsidian-plugin/src/mapView/MindmapNoteView.ts` (`writeEdit`, `savePositions`, `reloadFromFile` with its
  newest-read-wins counter), session: `obsidian-plugin/src/mapView/noteSession.ts`.
- E2E harness and journeys: `obsidian-plugin/e2e/` (see `docs/architecture.md` "Obsidian E2E").

## Non-goals
- The rare "external edit within milliseconds of a drag" case (self-corrects on reopen).
- Any new feature or menu entry.
