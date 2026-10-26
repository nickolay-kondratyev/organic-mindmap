---
id: nid_89ap39gl425o98g5qnhkuszdl_e
title: "Library: right-click hook on nodes (onNodeContextMenu)"
status: open
deps: [nid_b83apppr45lbst30ia592ohg0_e]
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
A mindmap note needs delete, but the map has no delete control (the "x" was removed). The host should show its own
menu (Obsidian's `Menu`) on right-click of a node and call `handle.requestEdit({ type: 'delete', ... })` from it,
so delete goes through the existing request -> confirm protocol.

## Done criteria
- `MountOptions.onNodeContextMenu?(event)` with the node id and the screen (client) point; also passed through the
  React `<Mindmap>` wrapper. The browser's own context menu is suppressed only when the hook is set and the
  right-click hits a node.
- Right-click on empty canvas does not call the hook.
- Unit tests for the hit/no-hit rule; one demo E2E journey: right-click a node -> demo shows a "Delete" action ->
  the node and its subtree are gone. The library README's "Navigation hooks" paragraph (root `README.md` until
  `nid_eqq17z13ui62faww955vkjdjp_e` moves it to `core/README.md`) and `core/CHANGELOG.md` mention it.

## Context
- Options: `core/src/core/mount.ts` (`MountOptions`, existing `onNodeClick` is the pattern to follow);
  click event type next to it; `core/src/react/Mindmap.tsx`.
- Delete is already validated and handled: `core/src/core/edit/editValidation.ts`,
  `core/src/core/edit/editSession.ts`; `requestEdit` is on the handle.
- Demo host: `core/demo/host/`.

## Non-goals
- A library-drawn menu; per-node rules; touch long-press.
