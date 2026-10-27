---
closed_iso: 2026-10-27T15:45:24Z
id: nid_x9jc2ml9mws9tn4l013zuc68r_e
title: "Plugin: Ctrl+Z / Ctrl+Shift+Z undo and redo map edits"
status: closed
deps: []
links: []
created_iso: 2026-10-27T15:11:07Z
status_updated_iso: 2026-10-27T15:45:24Z
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_organic-mindmap/.worktree/t-x9jc2ml9
type: feature
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [map-polish]
profile: higher
---


## Goal
While a map is focused, Ctrl+Z undoes the last map change and Ctrl+Shift+Z redoes it (Cmd on macOS), so a person can try things on the map without fear. The note is plain Markdown and every map change is one stale-checked text write, so history is a stack of before/after note texts.

## Done criteria
- Map changes are undoable, one person action = one undo step: add, rename, move (reparent), delete, and drag-to-reposition (saved positions). If one action produces two writes (e.g. a reparent, then its saved positions), one Ctrl+Z undoes both.
- Ctrl+Z / Cmd+Z undoes; Ctrl+Shift+Z / Cmd+Shift+Z redoes (Ctrl+Y too only if free). Several steps back and forward work. A new map change after undoing clears the redo steps.
- Undo/redo only applies while the file still holds the text that step left (same rule as today's delete "Undo"); if the note changed from outside the map (typing in a Markdown tab, sync), history is dropped and a `Notice` says in plain words that there is nothing to undo from the map because the note changed (reuse the tone of `UNDO_CHANGED_SINCE_MESSAGE`).
- Keys reach the map only when the map view is the active view; while the inline rename editor input or the reparent dialog has focus, Ctrl+Z is the input's own (native) undo, not map undo.
- The delete `Notice` "Undo" button uses the same history (no second undo mechanism).
- History is per view and per note: switching the view to another file or closing it drops it.
- Unit tests for the pure history (stack, grouping, redo cleared on new change, stale rule) in a module that does not import `obsidian` (e.g. next to `obsidian-plugin/src/mapView/noteSession.ts`). Obsidian E2E: add a child, Ctrl+Z -> child gone from the file, Ctrl+Shift+Z -> back.
- `docs/architecture.md` (plugin section) and the plugin README's feature list, if it lists features, updated.

## Context
- `obsidian-plugin/src/mapView/noteSession.ts`: `WriteSnapshot { before, after }`; `applyEdit` returns `{ data, snapshot }`; `undo(snapshot, file)` does `file.process(t => t === snapshot.after ? snapshot.before : t)` and returns `'restored' | 'changedSince'`; writes are serialized on one promise chain (`enqueue`), stale-checked against the note text; `close()` rejects queued writes with `NoteClosedError`.
- `obsidian-plugin/src/mapView/MindmapNoteView.ts`: `writeEdit` calls `offerUndo(snapshot)` only for deletes (10 s `Notice` with "Undo"); `savePositions` writes offsets via the same session. No keyboard handling exists in the plugin today; Obsidian's idiom is the view's `scope` (`new Scope(this.app.scope)`, `scope.register(['Mod'], 'z', ...)`), which is active only while the view is focused.
- Core inline editor / reparent dialog have their own `keydown` listeners (`core/src/core/interaction/inlineLabelEditor.ts`, `reparentDialog.ts`).

## Constraints
- Undo/redo writes go through the session's write queue (never a parallel write path), so they serialize with edits already in flight.
- After an undo/redo the map shows the note as written (the normal reload path), including saved positions.

## Non-goals
- No history across reloads or across files; no persistent history.
- No undo of changes made outside the map (that is the Markdown editor's own undo).
