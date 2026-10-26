---
closed_iso: 2026-10-26T23:33:46Z
id: nid_h4bhoi9jvbh3zny2ldnuxb0sq_e
title: "Epic: Obsidian plugin, mindmap file first"
status: closed
deps: [nid_b83apppr45lbst30ia592ohg0_e, nid_eqq17z13ui62faww955vkjdjp_e, nid_uevv14z32jm6npvl0gwef6kpy_e, nid_iexvo4oqwq038twvy9od9gm2b_e, nid_89ap39gl425o98g5qnhkuszdl_e, nid_lmtjqrjec483zha67vaaeydez_e, nid_kjtran7bnslnah9gj2fjr69rx_e]
links: []
created_iso: 2026-10-26T22:24:59Z
status_updated_iso: 2026-10-26T23:33:46Z
type: epic
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [obsidian-mindmap-file]
---

## Goal
This repo becomes the `organic-mindmap` Obsidian plugin repo (npm workspaces monorepo). The first thing the plugin
does is the **mindmap file**: a normal Markdown note flagged `organic-mindmap: 1` that opens as a map (like
Excalidraw's `.excalidraw.md`), so Obsidian keeps its `[[links]]` updated on rename.

## Plan (decided 2026-10-26, human)
- Library (today's `src/`, `demo/`, tests) moves to `core/` (package `organic-mindmap`); the plugin is
  `obsidian-plugin/` and imports only the library's public entry points. The library never imports `obsidian`.
- The plugin is set up with real-Obsidian E2E tests first; logic is tested with unit/integration tests, E2E only
  for key journeys.
- README becomes plugin-first.
- Order changed (human, 2026-10-26): the mindmap file comes **before** the heading map of one note
  (`nid_2dx988s7h0ciygu9ofbtx1b6r_e`, separate tag).
- File format: `next-steps-prior-to-obsidian.md` "Phase 1a" (nested list = tree, block id = node id, positions as
  parent offsets in a `%%`-hidden JSON block).

## Order
1. `nid_b83apppr45lbst30ia592ohg0_e` monorepo move (solo).
2. `nid_eqq17z13ui62faww955vkjdjp_e` plugin package + Obsidian E2E + README.
3. In parallel: `nid_uevv14z32jm6npvl0gwef6kpy_e` file format (needs 2), `nid_iexvo4oqwq038twvy9od9gm2b_e` saved
   positions (library) and `nid_89ap39gl425o98g5qnhkuszdl_e` right-click hook (library); the two library tickets
   only need 1, so they may run alongside 2.
4. `nid_lmtjqrjec483zha67vaaeydez_e` map view for mindmap notes.
5. `nid_kjtran7bnslnah9gj2fjr69rx_e` saved positions + delete in the plugin.

## Done criteria
All dependency tickets closed; a user can create a mindmap note, edit it on the map (add, rename, move, delete,
drag), close and reopen it with positions kept, and rename a linked note with the link in the mindmap updated.
