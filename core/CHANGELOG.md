# Changelog

Versions are git tags (`vX.Y.Z`); the package is not published to npm yet. `dist/` is not committed, so a git
dependency on a tag does not get a built library on its own; build from the tagged commit (`npm run build`).
While 0.x, a minor version may change the API.

## 0.2.0

What the Obsidian heading map of one note needs (spec I7-I10, D7/D8; details in `docs/architecture.md`).

### Added
- `onNodeClick(event)` (mount option and `<Mindmap>` prop): a click on a node, root included, with the node id and
  the held modifier keys. Drags, pans and hover buttons do not fire it; a double-click fires it twice.
- `setHighlightedNode(id | null)` on the handle and the `<Mindmap>` ref: rings one node in the new
  `theme.color.highlight`.
- `centerOnNode(id)` on the handle and the `<Mindmap>` ref: pans to the node, keeping the zoom.
- `interaction.allowAdd` / `allowRename` switches for a move-only map; `allowDelete` is reserved (no in-map
  delete control yet).
- `layout.sideOrder: 'clockwise'`: first-level nodes in document order (first half right top to bottom, second half
  left bottom to top). Default `alternating` keeps the old order.
- `text.nodeFit.minFontScale`: a long node label shrinks down to this, then ends with "…". Default 0 keeps the old
  unlimited shrinking.
- Labels with characters the label font lacks (emoji, CJK, Cyrillic, ...) are no longer drawn on their branch, and
  their node label uses system fallback fonts, so every character shows (spec R17 exception).
- `npm run bench`: `buildScene` timings per map size (a report, not a test gate).
- Demo: "Paste Markdown" shows a note's headings as the map; the clicked node is highlighted and the click readout
  shows what the host was told.

### Changed
- The scene is cached: hover, pan, zoom and the busy animation no longer rebuild layout and branches. Branch
  routing skips limb pairs that cannot touch, so large maps build much faster. The default look is unchanged.
- The hover "+" stays reachable while the pointer travels to it.
- `<Mindmap>` mounts before attaching its ref, so a non-null ref is always usable.

### Removed
- The hover "×" delete button. Hosts send `delete` from their own UI (`requestEdit`).

## 0.1.0

First version (spec.md v1), not tagged: hand-drawn bilateral map, glyph-outline labels along branches, request ->
confirm edits, pan/zoom, settings storage seam, demo runner.
