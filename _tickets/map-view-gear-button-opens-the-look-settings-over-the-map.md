---
closed_iso: 2026-10-27T16:01:27Z
id: nid_g8wymric04axnhd7lcoox7tkl_e
title: "Map view: gear button opens the look settings over the map"
status: closed
deps: []
links: []
created_iso: 2026-10-27T15:49:42Z
status_updated_iso: 2026-10-27T16:01:27Z
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_organic-mindmap/.worktree/t-g8wymric
type: feature
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [map-polish]
---


## Goal
The human wants to adjust the map's look (branch colors, fonts, background) right from the map, without going to Obsidian's settings. A collapsed gear button on the map expands into a small panel with the same controls as the plugin's settings tab, so a person sees each change on the map as they make it.

## Done criteria
- An open map view shows a small gear button in its top-right corner (over the canvas, always visible, does not block map interaction elsewhere). Tooltip / `aria-label`: "Map settings".
- Clicking it expands a compact panel anchored to that corner, over the map, with exactly the settings tab's controls: Branch colors, Node font, Branch font, Background color, Restore look defaults. The map stays visible and updates live.
- The panel closes on: clicking the gear again, Escape, clicking outside it (on the map). Focus returns to the gear on close (keyboard users).
- Settings stay global: the panel and the settings tab write the same `MapSettings`, so a change applies to every open map and persists exactly as the tab's do. The tab and the panel show the same values (open the panel after changing the tab and vice versa).
- One source for the controls: the tab and the panel build their rows from the same code (no second copy of the dropdown/picker wiring in `obsidian-plugin/src/settings/MapSettingsTab.ts`).
- The panel is themed with Obsidian CSS variables (`styles.css` at repo root), readable in light and dark Obsidian themes, and keyboard reachable. Use the `my-frontend-design` skill (and `obsidian-settings` for the row conventions).
- Tests: pure open/close decision logic (if any) unit-tested; one Obsidian E2E journey: click the gear -> panel shows; change background color -> the open map's `mapHandle.getConfig()` reports it; Escape closes the panel. No look assertions.
- `docs/architecture.md` plugin section and `README.md` settings mention updated.

## Context
- Settings model: `obsidian-plugin/src/settings/mapSettings.ts` (`MapSettings`: `config`, `onChange`, `setPalette`, `setBackground`, `setNodeFont`, `setBranchFont`, `resetLook`); choices in `fontChoices.ts`, `palettePresets.ts`; tab in `MapSettingsTab.ts` (Obsidian `Setting` rows; it re-renders after reset).
- Map view: `obsidian-plugin/src/mapView/MindmapNoteView.ts` (`FileView`; `contentEl` gets class `organic-mindmap-view`, holds the canvas; it already receives `settings` via its deps and follows `onChange`). Canvas styling in `styles.css` (`.view-content.organic-mindmap-view` is `position: relative`).
- Library DOM overlays (inline editor, notice, reparent dialog) are siblings after the canvas; the panel is plugin DOM, not library.
- Obsidian E2E harness: `obsidian-plugin/e2e/obsidianHarness.ts`; existing settings journey `obsidian-plugin/e2e/settings.e2e.ts`.

## Constraints
- Obsidian `Setting` rows can be built into any container element, so the shared row builder takes a container plus `MapSettings`.
- WHY-NOT a view header action + `Modal`: a modal dims and covers the map, so a person cannot see the change while making it.

## Non-goals
- No per-map (per-note) settings; no new settings beyond the tab's; no layout/size settings.
