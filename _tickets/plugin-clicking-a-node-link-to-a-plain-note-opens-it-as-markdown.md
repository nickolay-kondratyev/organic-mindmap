---
closed_iso: 2026-10-27T15:19:58Z
id: nid_fai5tp8qj4o6vpf0gmjj6h8rg_e
title: "Plugin: clicking a node link to a plain note opens it as Markdown"
status: closed
deps: []
links: []
created_iso: 2026-10-27T15:11:07Z
status_updated_iso: 2026-10-27T15:19:58Z
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_organic-mindmap/.worktree/t-fai5tp8q
type: feature
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [map-polish]
---


## Goal
Clicking a map node whose item is `[[Some note]]` must open `Some note` the normal way: as Markdown when it is a plain note, as a map when it is itself a mindmap note. Today (human report) navigating from the map to a plain Markdown note does not just open it as Markdown.

## Done criteria
- Plain click on a link node whose target is a plain Markdown note opens that note in a Markdown view in the same leaf (Ctrl/Cmd-click: new tab, as today).
- A link node whose target is a mindmap note (`organic-mindmap: 1`) still opens it as a map.
- Going back (Obsidian back navigation) from the opened note returns to the map.
- Opening a plain note in the leaf by any other route (file explorer, quick switcher) while the map is showing behaves the same: Markdown, never the map view's "not a mindmap note" problem screen.
- Obsidian E2E journey in `obsidian-plugin/e2e/mindmapNote.e2e.ts` (or a new spec): click a link node to a plain note -> the active view is Markdown on that note. Plus one for a mindmap target if cheap. Pure decision logic (if any is added) unit-tested.

## Context
- `obsidian-plugin/src/mapView/MindmapNoteView.ts` `openNodeLink` calls `this.app.workspace.openLinkText(target, this.file.path, inNewTab)` with `firstLinkTarget(node.rawText)` (`obsidian-plugin/src/mapView/linkTarget.ts`).
- Likely root cause (verify first, reproduce in E2E before fixing): the view is a `FileView` with `canAcceptExtension('md') === true`, so Obsidian's `leaf.openFile` loads the plain note into the existing map view instead of switching view type; the map view then shows `renderProblem` (messages from `obsidian-plugin/src/mindmapNote/readMindmapNote.ts` `NOTE_PROBLEM`, e.g. "A mindmap note needs exactly one top-level list item...").
- Routing: `obsidian-plugin/src/main.ts` wraps `WorkspaceLeaf.setViewState` (`routeSetViewState`) and sends `markdown` requests for mindmap notes to the map view (`obsidian-plugin/src/mapView/viewSwitch.ts`). Any fix must keep that one detection rule (`isMindmapNote` on file text).
- `docs/architecture.md` "Obsidian plugin" section describes routing; update it with the fix.

## Constraints
- A broken mindmap note (flagged, but e.g. two top-level items) must still show the problem screen with "Open as Markdown"; only unflagged notes go to Markdown.
