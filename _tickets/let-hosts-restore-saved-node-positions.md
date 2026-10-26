---
id: nid_iexvo4oqwq038twvy9od9gm2b_e
title: "Let hosts restore saved node positions"
status: open
deps: [nid_b83apppr45lbst30ia592ohg0_e]
links: []
created_iso: 2026-10-23T01:11:55Z
status_updated_iso: 2026-10-23T01:11:55Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_h4bhoi9jvbh3zny2ldnuxb0sq_e
tags: [mindmap-v1, obsidian-mindmap-file]
---

## Goal
Hosts like Obsidian need dragged node positions to survive a reload. Today the library reports repositions via the position-change event (spec I2) but offers no way to hand saved positions back, so every reload snaps nodes back to auto layout.

## Decision (2026-10-26, human): unblocked
The Obsidian mindmap file needs it (`next-steps-prior-to-obsidian.md`, "Library work for the mindmap file").
That host has one stable id per node (the list item's block id), so the identity question below does not block
this ticket: keep the library API keyed by plain `NodeId`; any layered identity stays in the plugin.
Positions are saved and restored as an **offset from the parent**, not absolute map coordinates (decision 4 in
`next-steps-prior-to-obsidian.md`): adding a node shifts the auto layout, and absolute positions would land wrong.

Superseded (2026-10-23): the ticket waited for a real host and for a "layered identity" API; both are settled above.

## Done criteria
- Hosts can pass saved positions (by node id, as **offset from the parent node's position**) at mount and update them later via the public API and `<Mindmap>` props; layout honors them as overrides; positions for unknown ids are ignored.
- The host is told every user drag in the same offset-from-parent shape (extend or complement `onNodeReposition`, which today reports an absolute scene point), so what it saves can be handed back unchanged.
- A dragged node's subtree still moves with it; a saved offset survives the parent itself being auto-laid-out somewhere else (it lands relative to the parent's new spot).
- Unit tests cover override application, unknown ids, and the save -> restore round trip; the library README (root
  `README.md` until `nid_eqq17z13ui62faww955vkjdjp_e` moves it to `core/README.md`) and `core/CHANGELOG.md` document
  the API.

## Context
- Position overrides already exist internally: `core/src/core/layout/positionOverrides.ts` (absolute scene points, root at origin, kept in drop order); they live in `core/src/core/interaction/localEditState.ts` and reach `buildScene` (`core/src/core/render/scene.ts`). Reposition event: `core/src/core/interaction/repositionEvent.ts`; mount in `core/src/core/mount.ts`; React wrapper `core/src/react/Mindmap.tsx`.
- Consumer: the mindmap note's layout block (`nid_kjtran7bnslnah9gj2fjr69rx_e`, format in `next-steps-prior-to-obsidian.md` "Phase 1a": `{"n7f3k": {"dx": 120, "dy": -40}}`).

## Non-goals
- Library-side persistence or storage.
