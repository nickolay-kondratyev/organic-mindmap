# Hand-Drawn Mindmap — Requirements Spec

> **Status (2026-10-23):** v1 implemented (epic `nid_hc65067veoxpca8wtir8bnj2e_e`); v0.2.0 adds what the Obsidian
> heading map of one note needs (epic `nid_rk795rjqzzksdjrhm03dy6s7l_e`: L8 scene cache, I7-I10, R2/R19 options, the
> R17 exception, D7/D8; see `CHANGELOG.md`). §7 sketch mode (rough.js) not started. Review decisions in `_agent_decisions/needs_review/`.

## 1. Goal

Build a **reusable TypeScript library** that renders a mindmap that **feels hand-drawn**, like mind mapping on paper:
a central root with thick, curved, tapering branches sweeping left and right, each
branch carrying its label **bent along the curve**. The library is consumed from a
React web UI, but consider the actual logic itself to NOT depend on react and only having a React wrapper on top if it makes sense.

v1 success = the library, given the seed data in §8, renders a view matching the
reference view described there (Shakespeare mindmap, dark background), but feel free to re-evaluate as well.

Math and algorithm details (curve formulas, tapering profile, layout constants, text
fitting steps) are intentionally out of scope here, you should come up with fitting algos yourself for nice tapering, you can use things like golden ratio for V1. 

The library should expose the different settings, and we should also have a runner UI that is able to tweak the different settings that the mindmap will take in as well as runner being able to manipulate nodes like adding and removing nodes. 

## 2. Visual requirements (what the initial view must look like)

**Canvas**
- R1. Rendered on an HTML canvas over a single dark theme (near-black navy background).
  - We should have the theming be easily tweakable as well so that can be one of the input parameters like part of the nested object settings.theme.color.XXX

**Nodes**
- R2. Every node is a filled **ellipse** with its label centered inside in straight text.
  - For now its ellipse yes but also think of extensibility that these can be replaced with other shapes and sizes so make sure this is built in extensible format.
  - A label wider than its node shrinks to fit. Optional minimum (`text.nodeFit.minFontScale`, a fraction of the
    font size): below it the label is cut and ends with "…". Default 0 = shrink without limit, never cut.
- R3. The root is visually distinct: neutral dark slate fill, larger box, label is boldened.
  - yes root center is visually distinct.
- R4. Node boxes shrink with tree depth (root largest, leaves smallest).
  - Shrinking is only the DEFAULT. A child node may be larger than its parent (per-node `size` in data, or a depth scale > 1); layout, branches and text must not assume child < parent.
  - yes.
**Branches**
- R5. Every parent→child link is drawn as a **filled, tapered, curved limb**: thick
  where it leaves the parent, thinning toward the child. Thickness also decreases
  per tree level, so the root's branches are the dominant visual mass and leaf
  branches end thin.
  - The tapering and width should come be one of the settings values that should be easily tweakable. 
- R6. Branches are smooth curves, not straight lines. Root branches leave the root
  nearly horizontally and settle smoothly into the child.
  - Yes it should feel hand-drawn and pleasant to use.
- R7. Edges of a branch are slightly asymmetric, giving a hand-made rather than
  mechanical look.
  - yes think handmade feel.
- R8. Branches route around unrelated nodes instead of crossing over them.
  - yes they repel each other if someone moves the braenches over them.
  - branches repel each other and nodes repel each other as well (if the human moves them around)
- R9. Branches run center to center; nodes are drawn on top and hide the stubs.
  
**Color**
- R10. Each first-level branch gets a distinct palette color; all its descendants
  (branches and nodes) inherit it, so each major limb reads as one colored subtree.
- R11. The palette is ordered so neighbouring branches contrast strongly. Each color
  has a fill and a darker outline shade (node outlines use the darker shade).
  By default the branch color is derived from parent but the coloring MUST be adjustable
  as well in near future we will will have the use cases like:
  - color comes from visitation history, where coloring is mixed from child notes.

**Branch text (the signature feature)**
- R12. Each non-root node's label is also rendered **along its incoming branch**,
  glyph by glyph, each glyph rotated to follow the curve. The label therefore
  appears twice (on the branch and in the node); this is intended.
  Example library: **opentype.js** parses the TTF and gives
  each glyph's outline and advance width, so glyphs can be placed and rotated one
  at a time along the curve.
- R13. Text on left-side branches is flipped so it always reads left→right, upright.
- R14. Branch text sits vertically centered on the curve, in the space between the
  two node rims.
- R15. If the label does not fit, it adapts automatically: first tighter letter
  spacing, then less padding, then a smaller font. Glyphs that still overflow are
  dropped; the label never spills past the curve end.
- R16. Branch text is white with an optional outline; it is not drawn until its font
  has loaded.

**Typography**
- R17. Text uses real font glyph outlines (not `ctx.fillText`) so it can bend and so
  styling (letter spacing, stretch, slant, bold, outline) is uniform.
  - Exception (decided 2026-10-23): a label with a character the label font lacks (emoji, CJK, Cyrillic, ...)
    is not drawn on its branch, and its node label is drawn with `ctx.fillText` and a CSS font list that starts
    with the label font, so system fonts supply the missing glyphs and every character shows. Labels the font
    fully covers always use outlines.
- R18. Default font is a handwritten one (e.g. **Kalam**). Branch text and node
  text fonts are configurable independently.

**Layout**
- R19. The map is **bilateral**: first-level children split into a left and a right
  side; deeper nodes grow outward on their parent's side.
  - First-level nodes without an explicit `side` are split by `layout.sideOrder`: `alternating` (default: right,
    left, right, ... in data order) or `clockwise` (the first half on the right, top to bottom, then the second half
    on the left, bottom to top, so the map reads in document order). An explicit `side` always wins.
- R20. Auto layout produces a tidy tree per side (no overlapping subtrees), vertically
  centered on the root.
- R21. First-level branches **fan out in an outward bow**: the farther a branch is
  vertically from the root, the farther out horizontally it sits (golden-ratio-shaped
  curve). Its whole subtree moves with it.
- R22. Optional hand-drawn irregularity (small jitter/stagger) must be **deterministic**
  (same data ⇒ same picture on every render).
- R23. Overlapping nodes are pushed apart; the root never moves.

## 3. Library requirements (interface & extensibility)

- L1. **One package, framework-free core + thin React wrapper:**
  - **core** — plain TypeScript, never imports React: data model, layout, branch
    geometry, text rendering, canvas drawing, interaction and edit protocol (§6).
    Unit-testable without rendering components.
  - **React wrapper** — a `<Mindmap>` component that mounts a canvas, wires resizing,
    and maps props/callbacks onto core.
- L2. **Controlled data.** The host owns the mindmap data (a flat list of nodes with
  `id`, `parentId`, `text`, side, optional color index and size). The library renders
  what it is given and never mutates host data. View changes and repositions are
  reported as events; structural edits go through the request → confirm protocol
  (§6 I5). Works naturally with React `useReducer`/Context.
- L3. **Clean public surface.** A small, documented API: data types, a render/mount
  entry point, a layout function, and a config object with sensible defaults. Every
  visual parameter is optional; zero-config must produce the reference look.
- L4. **Typed config, discriminated unions.** Layout algorithms are selected by a
  `type` discriminant with exhaustive handling, so adding one is a compile-checked
  change.
- L5. **Extension points** (via composition, no subclassing):
  - Layout as a **pipeline of pluggable stages** (tree → root-branch bow → hand-drawn
    variation → collision); hosts can reorder, remove, or add stages.
  - **Pluggable curve function** for the root-branch bow.
  - **Node shape** (ellipse in v1): shape drawing, can be swapped to OTHER shapes. 
  - Theme: palette, background, root styling.
  - Fonts: host supplies font URLs or bytes; the library parses them.
- L6. **Fonts load asynchronously** with an observable status (loading / loaded /
  error) so the host can show a loading state. Font failure must not crash rendering.
- L7. **Pure layout.** Layout is callable on its own (data in → positioned data out),
  so hosts can lay out, persist, or animate without rendering.
- L8. Rendering is efficient: multiple changes within a frame coalesce into one paint.
  - The scene (layout, branches, labels) is rebuilt only when data, config, extensions or dragged positions change;
    hover, pan, zoom and the busy animation repaint the cached scene. `npm run bench` reports `buildScene` times per
    map size (a report, not a test gate).

## 4. Key external libraries

| Library | Use |
|---|---|
| **opentype.js** | Parses TTF fonts and exposes per-glyph outlines and advance widths; this is what lets text bend along a branch (R12–R17). |
| **d3-hierarchy** | Reingold–Tilford tidy-tree layout, run per side (R20). |
| **rough.js** | Optional sketch mode: pencil-style rendering of branches and node ellipses (§7, later). |
| React | Host UI and the binding layer only (not used by core). |
| TypeScript (strict), Vite, Vitest | Language, build, unit tests. Playwright for screenshot verification. |

Fonts are fetched as TTF from a public CDN (e.g. Fontsource).

## 5. Quality requirements

- Q1. Rendering is deterministic for the same data and config.
- Q2. Core logic (layout, geometry, text fitting) is covered by BDD unit tests.
  - We should aim for testing pyramid, whenever we can push the testing down the pyramid we should. 
- Q3. The reference view (§8) is verified by a Playwright screenshot.
- Q4. The edit protocol (§6 I5) is unit-tested in core: pending blocks edits,
  confirm renders host data, reject restores the prior state.

## 6. Interaction (in scope for v1)

The key interface goal: hosts like Obsidian can back nodes with real files, so a
structural edit is only shown as done once the host has actually done it.

**View actions** (library-local, never need host confirmation)
- I1. Pan by dragging empty canvas. Zoom with the mouse wheel, anchored at the
  cursor (the point under the cursor stays put). Zoom in/out/reset are also on the
  API for host buttons. The host can read and set the view.
- I2. Reposition: dragging a node moves it with its whole subtree; nearby nodes are
  pushed apart (R23) and branches re-route (R8). Dragged to the other side of its
  parent, the subtree flips left/right around the node so its children grow away
  from the parent (dragging it back flips it back); the preview shows the flip. A
  small movement threshold keeps clicks and double-clicks from turning into drags.
  Reported as a position-change event; positions are layout, not structure, so no
  confirmation.

**Structural edits** (always go through the host)
- I3. Move (reparent): drag a node and drop it onto another node to make it that
  node's child; its subtree comes along. The drop target highlights while hovered.
  Dropping onto itself or its own descendant is refused before any request is sent.
  The user confirms the drop first (Cancel leaves the map as before the drag); "Don't
  ask again" turns that off as a stored setting the user can turn back on.
- I4. Add child (hover "+" button on the node's outer side; it stays shown while the
  pointer travels from the node to it), rename (double-click to edit the label inline,
  in the real font). The map offers no delete button: deleting is destructive, so a
  host offers it through its own UI via the `delete` request (undo is the host's job,
  e.g. Obsidian trash).
- I5. **Request → confirm protocol:**
  1. The library sends a typed edit request (`move`, `add`, `rename`, `delete`) to a
     host handler that returns a Promise.
  2. While pending: the intended result is shown as pending (e.g. dimmed node at the
     target) with a busy indicator, and **all further edits are blocked**. View
     actions (I1) stay available.
  3. Resolved = the host applied it (e.g. Obsidian moved the file). The library then
     renders the host's updated data; it never applies a structural change itself.
  4. Rejected = the pending preview is dropped, the map returns to its prior state,
     and the host's reason is shown in plain language. Typed input (e.g. a new
     label) is kept for retry.
  - The host must always settle the promise; v1 has no library-side timeout.
- I6. A default in-memory host confirms immediately, so the library works with no
  external system. The demo runner (§6a) uses it.

**Host hooks for navigation** (e.g. click jumps to a heading, the map follows the editor cursor)
- I7. Node click: a press and release on a node without a drag (root included) reports the node id and the held
  modifier keys (Ctrl, Cmd, Alt, Shift) via `onNodeClick` (mount option and `<Mindmap>` prop). Drags, pans, hover
  buttons and bare canvas are not node clicks. Every click is reported at once, so a double-click reports two clicks
  (plus the rename, when renaming is on); clicks are not delayed to tell them apart.
- I8. Highlight: the host rings one node, or none (`setHighlightedNode(id | null)` on the handle and the `<Mindmap>`
  ref), in `theme.color.highlight`. An unknown id shows no ring.
- I9. Center on node: `centerOnNode(id)` pans so the node sits at the canvas center, keeping the zoom; reported like
  other library view changes (I1). An id not on the map does nothing.
- I10. Edit switches: `interaction.allowAdd` and `interaction.allowRename` (default on) turn off the "+" and the
  double-click rename editor, giving a move-only map; moving by drag still works through I3/I5.
  `interaction.allowDelete` is reserved for a future in-map delete control (the map has none, I4). The switches gate
  only the map's own controls, never requests the host sends itself (`requestEdit`).
- I11. Node right-click: a right-click on a node (root included) reports the node id and the viewport (client) point
  via `onNodeContextMenu` (mount option and `<Mindmap>` prop), so the host can show its own menu there (e.g. delete
  via `requestEdit`); the library draws no menu. While the hook is set, the browser's context menu is suppressed on
  nodes only; bare canvas and preview/draft nodes keep it and do not report.

## 6a. Demo runner (in scope for v1)

A small React app shipped with the library.
- D1. Uses the library **only through its public API**, so it doubles as proof that
  the API is enough for a real host.
- D2. Starts on the reference data (§8) with default settings.
- D3. Settings panel with live controls for every exposed setting (theme colors,
  branch width/tapering, layout, text styling, fonts), plus reset to defaults.
- D4. Node editing: add, remove, rename, move, all through the I5 protocol using the
  in-memory host (I6).
- D5. Host simulation toggle: make the in-memory host delay or reject requests, so
  pending and rejected states can be seen and tested without an external system.
- D6. Reset the map to the reference data.
- D7. Paste Markdown: the runner shows a pasted note's headings as the map, mapped the way the Obsidian heading map
  will: the root is the single H1 if there is exactly one, else a fixed title ("Pasted note"); each heading's parent
  is the nearest heading above it with a lower level (skipped levels attach to that heading); text before the first
  heading is ignored; `#` lines inside fenced code blocks are not headings. The parser lives in `core/demo/` only (the
  library stays Markdown-free). "Reset map" (D6) goes back to the reference data.
- D8. Host hooks are visible: the runner highlights the clicked node (I7, I8) and shows which node and keys the
  host was told.

## 8. Reference data (acceptance view)

Root `SHAKESPEARE`. Labels: first level uppercase, leaves title case.

First-level nodes are listed top to bottom per side.

| Side | First level | Children |
|---|---|---|
| Right | VIDA | Hamlet, Othello |
| Right | POESIA, COMEDIA, HISTORIA | — |
| Left | TRAGEDIA | Macbeth, King Lear |
| Left | SONETOS, AMOR, MAGIA | — |

Each first-level node has its own palette color; children inherit their parent's
color.

**Expected look (acceptance view):**
- **Spread:** four limbs fan out per side. The top and bottom first-level nodes sit
  farthest out horizontally, the middle ones closer to the root, so each side forms
  a soft outward bow.
- **Proportions:** where a branch leaves the root it is about as thick as a node is
  tall; it tapers into the first-level node. Branches into leaves are thinner and end
  only a few pixels wide. The root is the largest node, leaves the smallest.
- **Forks:** a parent's children split off as a soft "Y" close to the parent node,
  not as separate long lines.
- **Colors:** warm, saturated but soft hues (e.g. goldenrod, coral, cornflower blue,
  sage green, slate violet, orchid, olive, teal) on a near-black navy background.
  Each node is outlined in a darker shade of its fill.
- **Root:** dark slate fill with a slightly lighter outline and a white uppercase label.
- **Text:** handwritten font, white. Branch labels are about the same size as node
  labels, follow the curve, read left→right on both sides, and stay legible against
  the branch color.
