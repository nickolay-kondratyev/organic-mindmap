---
id: nid_8ldir8fohuk5xcwue8ej8noex_e
title: "Map: show the '+' on both sides of every node"
status: open
deps: []
links: []
created_iso: 2026-10-27T15:11:07Z
status_updated_iso: 2026-10-27T15:11:07Z
type: feature
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [map-polish]
---


## Goal
After a person drags a branch across the root to the other side, its nodes still show the hover "+" on the old side, pointing into the map. KISS fix asked by the human: every node shows a "+" on **both** sides (left and right), like the root already does. Both add a child.

## Done criteria
- Hovering any non-root node shows two "+" buttons, one left and one right of the node box; clicking either opens the inline editor for a new child of that node, and Enter adds it (same as today's single "+").
- The root keeps its two "+" and its current behavior (left/right "+" still carry `side` on the add request).
- `interaction.allowAdd: false` still hides all "+" buttons.
- The hover area (`near-handles`) still lets the pointer cross from the node to either "+".
- Unit tests in `core/src/core/interaction/hitTest.test.ts` (and `editAffordances` / `localEditState` tests if touched) cover: a non-root node has both handles; both open an add of a child of that node. Existing E2E journeys that click a "+" (`core/e2e/`, `obsidian-plugin/e2e/mindmapNote.e2e.ts` "grandchild via the child's +") still pass.
- `docs/architecture.md` "Hover buttons" line updated (it says "+" on the outer side).

## Context
- `core/src/core/interaction/hitTest.ts` `nodeHandles`: today a non-root node gets one handle on `scene.tree.sideOf(nodeId)` (tree side, not the painted side), so a dragged/mirrored subtree keeps the old side.
- `core/src/core/interaction/localEditState.ts` `addDraftRequest` attaches `side` only when the parent is the root; keep that.
- `core/src/core/interaction/canvasInteractions.ts` `onClick` -> `openAddDraft(handle.nodeId, handle.side, '')`.
- Handles must stay distinguishable in hit tests (two handles per node now); check for code that assumes one handle per non-root node (`hitTest.test.ts` has a root test "the root '+' buttons of both sides ... differ").

## Non-goals
- No "add on this side" semantics for non-root nodes: where the new child appears is up to the layout, as today.
- No change to how a dragged subtree mirrors.
