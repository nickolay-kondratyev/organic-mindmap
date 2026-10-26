---
id: nid_2dx988s7h0ciygu9ofbtx1b6r_e
title: "Plugin: heading map of the active note (navigate + move)"
status: open
deps: [nid_lmtjqrjec483zha67vaaeydez_e]
links: []
created_iso: 2026-10-26T22:25:00Z
status_updated_iso: 2026-10-26T22:25:00Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [obsidian-heading-map]
---

## Goal
Show the headings of the active note as a map: click jumps to the heading, the map follows the active note and the
heading under the cursor, and dragging a heading onto another moves that section in the Markdown. This was the
first planned launch; on 2026-10-26 the human moved it after the mindmap file (epic
`nid_h4bhoi9jvbh3zny2ldnuxb0sq_e`). Split into smaller tickets when picked up.

## Done criteria
- Behavior as decided in `next-steps-prior-to-obsidian.md` "Phase 1: plugin, heading map of one note" (mapping,
  move rules, refuse past H6, one undoable change, stale-note check).
- Unit tests for heading mapping and section move; one Obsidian E2E journey (open note -> map -> click jumps).

## Context
- Library side is done (v0.2.0: `onNodeClick`, `setHighlightedNode`, `centerOnNode`, `layout.sideOrder:
  'clockwise'`, move-only switches); see `core/README.md`.
- Reuse the map view plumbing from `nid_lmtjqrjec483zha67vaaeydez_e`.
- The heading -> tree mapping already exists for the demo in `core/demo/markdown/headingMap.ts` (ATX headings from
  pasted text); the plugin maps from `metadataCache` headings instead, but the parent rule and tests are a template.

## Non-goals
- Other heading edits (rename, add, delete), reorder siblings, folder map.
