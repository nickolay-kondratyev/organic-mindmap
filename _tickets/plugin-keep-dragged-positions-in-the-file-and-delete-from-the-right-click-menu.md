---
id: nid_kjtran7bnslnah9gj2fjr69rx_e
title: "Plugin: keep dragged positions in the file and delete from the right-click menu"
status: open
deps: [nid_lmtjqrjec483zha67vaaeydez_e, nid_iexvo4oqwq038twvy9od9gm2b_e, nid_89ap39gl425o98g5qnhkuszdl_e]
links: []
created_iso: 2026-10-26T22:25:00Z
status_updated_iso: 2026-10-26T22:25:00Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_h4bhoi9jvbh3zny2ldnuxb0sq_e
tags: [obsidian-mindmap-file]
---

## Goal
Finish the mindmap note: where the user drags a node is saved in the note and comes back on reopen, and nodes can
be deleted from Obsidian's right-click menu.

## Done criteria
- Dragging a node writes its offset from the parent into the note's layout block (format module); reopening the
  note (or reloading Obsidian) shows the node where it was left. Nodes without a saved offset use the auto layout.
- Right-click on a node shows Obsidian's `Menu` with "Delete"; it removes the item and its nested lines from the
  note. The root cannot be deleted (plain reason). Delete shows a notice with "Undo" that restores the previous
  text when the file has not changed since (destructive ops need undo).
- Obsidian E2E (one journey): drag a node, reopen the note, the node is still at the dragged spot (compare
  positions with a tolerance, not pixels of the look). Delete + undo are unit/integration tested.

## Context
- Library: saved-positions API from `nid_iexvo4oqwq038twvy9od9gm2b_e`, right-click hook from
  `nid_89ap39gl425o98g5qnhkuszdl_e`, both in `core/src/core/mount.ts`.
- View and format module: `obsidian-plugin/` (from `nid_lmtjqrjec483zha67vaaeydez_e`,
  `nid_uevv14z32jm6npvl0gwef6kpy_e`).

## Non-goals
- Saving pan/zoom or collapsed state; rename/reveal entries in the menu.
