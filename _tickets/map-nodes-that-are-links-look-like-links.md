---
id: nid_zk9gr2bj43l18yexsa0lsru28_e
title: "Map: nodes that are [[links]] look like links"
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
In a mindmap note, an item like `- [[Some note]]` shows on the map as plain text `Some note`, the same as an item without a link. A person cannot tell which nodes open a note when clicked. Nodes whose item contains a `[[link]]` must look like links at a glance.

## Done criteria
- The library's node data can mark a node as a link (an optional field on `MindmapNode`, e.g. `link: true`; name it in the library's vocabulary). Unmarked nodes render exactly as today (the reference screenshot `core/e2e/reference-view.spec.ts` passes unchanged).
- A marked node's label is visibly distinct on both places a label is drawn: along the branch (`drawBranchLabel`) and on the node (`drawNodeLabel`, including the system-font fallback path). Use a familiar link affordance (recommendation: underline, plus a link color from a new theme color such as `theme.color.link`, so it does not rely on color alone). Pick the exact look with the `my-frontend-design` skill; it must stay legible on every palette color and on the dark default background.
- The pointer cursor over a link node is `pointer` (familiar "this is clickable" cue), if the canvas cursor is already managed per hover target; otherwise skip this point and say so.
- The Obsidian plugin marks nodes whose item text contains a `[[link]]` / `![[embed]]` (the same rule `obsidian-plugin/src/mapView/linkTarget.ts` `firstLinkTarget` uses for clicks, so "looks like a link" and "click opens it" never disagree).
- The demo shows at least one link node in its reference data or Paste-Markdown path only if that is cheap; not required.
- Unit tests: the plugin's `toMindmapData` marks link items and not plain items; the library's label layout/paint decision for a link node (e.g. underline segment computed, link color chosen) is unit-tested in a pure module. A new theme color is restored by `restoreConfig` (shape-driven, should be free) and gets a demo settings control (shape-driven too).
- `docs/architecture.md` updated where labels / `MindmapNode` are described.

## Context
- Labels: `core/src/core/render/labelRenderer.ts` (`drawLabels`, `drawBranchLabel`, `drawNodeLabel`), layout in `core/src/core/text/labelLayout.ts` (`layoutBranchLabel`, `layoutNodeLabel`). Branch labels are glyph outlines along a curve, so an underline on a branch label follows the curve (sample the `BranchPath` under the glyph run).
- `MindmapNode` (`core/src/core/model/node.ts`) has `id, parentId, text, side?, colorIndex?, size?` and no style field today.
- Plugin: `obsidian-plugin/src/mindmapNote/mindmapNote.ts` builds `{ id, parentId, text: node.label }` in `toMindmapData`; `NoteNode.rawText` keeps the raw `[[link]]` text; `displayLabel` is in `obsidian-plugin/src/mindmapNote/linkLabel.ts`.
- Scene cache: `buildScene` runs only when inputs are new objects (`docs/architecture.md` "Scene cache"); a link flag in data flows through that for free.

## Non-goals
- No styling for unresolved links (target note missing). Can be a follow-up if wanted.
- No inline rich text (part link, part plain text): the whole label is marked.
