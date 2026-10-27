---
id: nid_0v1xv98rj4u0fertn6uxlhbeg_e
title: "Plugin: move a node with its subtree onto another node, and delete a subtree, proven end to end"
status: in_progress
deps: []
links: []
created_iso: 2026-10-27T00:00:08Z
status_updated_iso: 2026-10-27T00:00:56Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_organic-mindmap/.worktree/t-0v1xv98r
tags: [mindmap-editing]
---

## Goal
The human wants to restructure a mindmap in Obsidian: move a node together with its whole subtree under another
node, and delete a node with its subtree. Both are wired already (library drag-onto-node -> "Make child"
confirmation -> `move` edit; right-click "Delete" -> `delete` edit with Undo), but the plugin never proves move end to
end, and delete is proven only for a leaf. Prove both journeys in real Obsidian with subtrees, fill the unit gaps, and
fix whatever those tests expose.

## Done criteria
- Real-Obsidian E2E (`obsidian-plugin/e2e/mindmapNote.e2e.ts`): drag a node that HAS a child onto another node, click
  "Make child" in the confirmation -> the note text has the moved item and its child nested under the new parent
  (ids kept), and the map shows the new parent.
- Real-Obsidian E2E: right-click "Delete" on a node that has a child -> neither the node nor its child is in the note.
  (May extend the existing delete fixture instead of adding a new journey; Undo is already covered.)
- Unit tests in `obsidian-plugin/src/mindmapNote/mindmapNote.test.ts` for the uncovered move cases: moving a subtree
  under a parent that comes AFTER it in the file, and moving a subtree to a deeper level with grandchildren (each
  level re-indented); a session-level `move` test in `obsidian-plugin/src/mapView/noteSession.test.ts` (today it
  tests add, rename, delete only).
- Saved positions stay sensible: after a delete, the note's layout block no longer lists the deleted ids (today they
  linger until the next drag); after a move, decide whether the moved node's saved offset is kept or dropped and
  test the choice (recommendation: drop the moved subtree's offsets, since they were relative to the old parent;
  report it as a judgement call).
- `npm run typecheck`, `npm test`, touched demo E2E specs and `npm run test:e2e:obsidian` green.

## Context
- Note format reader/writer (pure text, no `obsidian`): `obsidian-plugin/src/mindmapNote/mindmapNote.ts`
  (`applyEdit`: `move` moves the item with `subtreeEnd`, re-indents, appends as last child; `delete` removes the
  subtree; neither touches the layout block). Format spec: `next-steps-prior-to-obsidian.md` "Phase 1a".
  `setPositions` already drops ids not in the note (see its tests).
- Session + view: `obsidian-plugin/src/mapView/noteSession.ts`, `obsidian-plugin/src/mapView/MindmapNoteView.ts`
  (`writeEdit` handles every edit type; Undo only for delete).
- Library side: drop onto a node -> `ReparentConfirmation` (`core/src/core/interaction/reparentConfirmation.ts`) ->
  `ReparentDialog` overlay (`core/src/core/interaction/reparentDialog.ts`, placed with
  `core/src/core/interaction/canvasOverlayElement.ts`) with "Make child" / "Cancel" / "Don't ask again". The demo
  journey is proven in `core/e2e/interactions.spec.ts` ("GIVEN Hamlet dragged onto POESIA").
- The existing Obsidian E2E shows how to drag (`page.mouse` down/move in steps/up) and locate nodes through the
  view's `mapHandle` (`getNodeScreenBox`).
- Ticket nid_76v6o4a80srw0tqec4ljx2hqw_e is fixing "+" doing nothing in real Obsidian in parallel. If the
  reparent dialog does not respond in real Obsidian the same way (overlay or focus problem), report it instead of
  working around it.
- Conventions: `CLAUDE.md` (Vitest BDD, one behavior per test, logic at unit level, E2E only key journeys, no look
  assertions; E2E specs never import modules that import `obsidian`).

## Non-goals
- A move command/menu other than drag-and-drop, keyboard moves, multi-select.
- Undo for move (Obsidian's own file history covers it; the destructive op is delete, which has Undo).
- The heading map's move (ticket nid_2dx988s7h0ciygu9ofbtx1b6r_e).
