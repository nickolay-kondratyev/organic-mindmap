---
closed_iso: 2026-10-26T23:03:42Z
id: nid_uevv14z32jm6npvl0gwef6kpy_e
title: "Mindmap file format: read a mindmap note and apply map edits to its text"
status: closed
deps: [nid_eqq17z13ui62faww955vkjdjp_e]
links: []
created_iso: 2026-10-26T22:25:00Z
status_updated_iso: 2026-10-26T23:03:42Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_h4bhoi9jvbh3zny2ldnuxb0sq_e
tags: [obsidian-mindmap-file]
---

## Goal
The plugin needs to turn a mindmap note into the library's `MindmapData` plus saved positions, and to turn each
map edit into a change of the note's text. Do it as plain TypeScript in `obsidian-plugin/` with **no `obsidian`
import**, so all of it is covered by fast unit tests and the Obsidian view (later ticket) is thin glue.

## Done criteria
- `isMindmapNote(text)`: true when the frontmatter has `organic-mindmap: 1`.
- Read: note text -> nodes (id, parentId, label text), saved positions by node id, or a plain-language problem
  (e.g. "A mindmap note needs exactly one top-level list item") when the list cannot be a tree or two items
  share a block id.
- Edits: `add`, `rename`, `move`, `delete` (the library's `EditRequest` from `core/src/core/edit/editRequest.ts`)
  each produce the new note text. They change **only the lines they touch** (the item's line; for move/delete the
  item with its nested lines, re-indented on move); every other byte stays as it was (other frontmatter keys,
  text outside the list, continuation lines). One exception: the first write from the map also adds a block id
  to every item that lacks one (see Constraints), so later writes have stable ids to key on.
- Positions: `setPosition(nodeId, { dx, dy })` (used by `nid_kjtran7bnslnah9gj2fjr69rx_e`) writes the layout block
  (parent offsets keyed by block id) deterministically (sorted keys, stable formatting) for clean diffs; a missing
  block is created after the list, inside `%%`; ids that are not in the list are dropped on write.
- New file content: a template for a new mindmap note with one root item.
- Unit tests (Vitest, BDD, one behavior per test) cover: tabs and spaces indentation, missing block ids, duplicate
  block ids, `[[links]]` and `[[note|alias]]` in labels, a missing or malformed layout block, text outside the list
  kept, moving into own subtree refused, deleting the root refused, round trip read -> no edit -> same text.

## Context
- Format (decided): `next-steps-prior-to-obsidian.md` "Phase 1a". Example:
  `- [[Some note]] ^n7f3k` nested under `- Project Phoenix ^root`, frontmatter `organic-mindmap: 1`, and a
  `%%`-wrapped fenced block `organic-mindmap-layout` with `{"n7f3k": {"dx": 120, "dy": -40}}`.
- Block ids: letters, digits and `-`, after a space at the end of the line (Obsidian's rule). Node id = block id.
- Library data model: `core/src/core/model/node.ts` (`MindmapNode`: `id`, `parentId`, `text`; flat list).
- The library's add request has no id; the host picks it, so this module generates new block ids (short, random,
  unique in the note).

## Constraints
- Decided defaults (change only with a reported judgement call):
  - Items without a block id get a generated id when read; the id reaches the file only with the next write from
    the map. Opening a note never rewrites it.
  - Labels show `[[links]]` as their display text (alias, else note name); the raw item text is kept so the view
    can open the linked note on click. Renaming writes the typed text as the item's text.
  - Indentation written for new or moved items follows the note's existing style (tab by default); `add` and
    `move` append the item as the last child of its parent.
- Parse the text yourself (no Obsidian metadata cache): it lags behind typing and is unavailable in unit tests.
- Generated ids are random, so they only resolve to a line within the parse that made them: edits take the parsed
  note (not raw text) as input. The view re-reads the file before applying an edit and refuses with "The note
  changed, try again" when the text differs from the parse the map was drawn from.

## Non-goals
- The Obsidian view, file I/O, commands (`nid_lmtjqrjec483zha67vaaeydez_e`).
- Sibling order editing; checkboxes or other list item syntax beyond keeping it in the text.
- Storing the `side` of first-level nodes: `AddEditRequest.side` is ignored, the auto layout picks the side after a
  re-read (saved offsets, `nid_kjtran7bnslnah9gj2fjr69rx_e`, pin the spot later). Revisit if users complain.
