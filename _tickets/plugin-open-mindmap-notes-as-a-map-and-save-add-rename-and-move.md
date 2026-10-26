---
id: nid_lmtjqrjec483zha67vaaeydez_e
title: "Plugin: open mindmap notes as a map and save add, rename and move"
status: open
deps: [nid_eqq17z13ui62faww955vkjdjp_e, nid_uevv14z32jm6npvl0gwef6kpy_e]
links: []
created_iso: 2026-10-26T22:25:00Z
status_updated_iso: 2026-10-26T22:25:00Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_h4bhoi9jvbh3zny2ldnuxb0sq_e
profile: higher
tags: [obsidian-mindmap-file]
---

## Goal
The first real plugin feature: a mindmap note opens as a map, and edits on the map are saved to the note, the way
Excalidraw handles `.excalidraw.md`. Because the file is a normal note with `[[links]]`, Obsidian updates links in
it when a linked note is renamed.

## Done criteria
- Command "Create new mindmap" creates `Mindmap <timestamp>.organic-mindmap.md` (in Obsidian's default new-note
  folder) from the format template and opens it as a map.
- Opening any note whose frontmatter has `organic-mindmap: 1` shows the map view instead of the Markdown editor
  (detection by frontmatter, not by file name). Commands/view menu switch between map and Markdown for that note.
- Add, rename and move on the map are written to the file through the format module
  (`nid_uevv14z32jm6npvl0gwef6kpy_e`) via `vault.process`; a failed write rejects the edit with a plain reason.
- When the file changes outside the map (typing in Markdown view, sync, Obsidian rewriting a link after a rename),
  the open map updates; the map never saves stale state over newer file content.
- A note the format cannot read shows the plain-language problem and a button to open it as Markdown.
- Clicking a node whose text has a `[[link]]` opens the linked note (Ctrl/Cmd-click: new tab).
- The Kalam font is bundled and served through the library's `fontFetcher` seam: no network request.
- Delete is not offered yet (`nid_kjtran7bnslnah9gj2fjr69rx_e`); positions are not saved yet (same ticket).
- Obsidian E2E (key journeys only): create a mindmap -> map shows the root; add a child on the map -> file text
  contains it; rename a linked note in the vault -> the mindmap file's link is updated and the map shows it.
  Everything else is unit/integration tested.

## Context
- Format module: `obsidian-plugin/` (from `nid_uevv14z32jm6npvl0gwef6kpy_e`). Library API:
  `core/src/core/mount.ts` (`mountMindmap`, `onEditRequest`, `onNodeClick`, `fontFetcher`, `setData`), edit
  protocol `core/src/core/edit/editRequest.ts`. `setData` keeps the user's dragged positions when data changes.
- Vendored font: `core/assets/fonts/kalam/latin-400-normal.ttf`; default URL in `core/src/core/config/config.ts`.
- Plan and pitfalls: `next-steps-prior-to-obsidian.md` "Phase 1a" and "0.6 Fit for Obsidian".
- E2E harness: `obsidian-plugin/` E2E from `nid_eqq17z13ui62faww955vkjdjp_e`. The link-rename journey only works
  when Obsidian's "Automatically update internal links" setting is on (the default); make the test vault state
  it explicitly so a changed default cannot break the journey silently.
- Generated ids for items without a block id are per-parse (format ticket Constraints): the view hands the format
  module the parsed note it drew, and re-reads before each write.

## Constraints
- Two maps open at once (two tabs) must not share state.
- Library dialogs/notices are fine as they are (not native-looking yet).

## Non-goals
- Saved positions, delete, settings tab, light theme, mobile, collapse, a heading map.
