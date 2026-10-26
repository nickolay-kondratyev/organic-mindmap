---
id: nid_iexvo4oqwq038twvy9od9gm2b_e
title: "Let hosts restore saved node positions"
status: open
deps: []
links: []
created_iso: 2026-10-23T01:11:55Z
status_updated_iso: 2026-10-23T01:11:55Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [mindmap-v1]
---

## Goal
Hosts like Obsidian need dragged node positions to survive a reload. Today the library reports repositions via the position-change event (spec I2) but offers no way to hand saved positions back, so every reload snaps nodes back to auto layout.

## Decision (2026-10-26, human): unblocked
The Obsidian mindmap file needs it (`next-steps-prior-to-obsidian.md`, "Library work for the mindmap file").
That host has one stable id per node (the list item's block id), so the identity question below does not block
this ticket: keep the library API keyed by plain `NodeId`; any layered identity stays in the plugin.
Positions are saved and restored as an **offset from the parent**, not absolute map coordinates (decision 4 in
`next-steps-prior-to-obsidian.md`): adding a node shifts the auto layout, and absolute positions would land wrong.

## Decision (2026-10-23, human): wait (superseded above)
Deferred until a real host (e.g. the Obsidian plugin) needs it.

Open design question to settle when this is picked up: **how a saved position finds its node again.** Hosts may not have one stable id per node. Example, Obsidian:
- `id` in the note's frontmatter is the golden identity, used when present.
- We do not want to force an `id` onto every note, so fall back to weaker identities such as file path, then file name.

So matching probably needs layered identities: each node can carry several, each with a priority, and a saved position matches through the strongest one available. Settle this with the real host before building the API below.

## Done criteria
- Hosts can pass saved positions (by node id) at mount and update them later via the public API and `<Mindmap>` props; layout honors them as overrides; positions for unknown ids are ignored.
- Unit tests cover override application and unknown ids.

## Context
- Position overrides already exist internally: `src/core/layout/positionOverrides.ts`; reposition event type in `src/core/interaction/`; mount in `src/core/mount.ts`; React wrapper `src/react/Mindmap.tsx`.

## Non-goals
- Library-side persistence or storage.
