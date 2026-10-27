# Architecture

## Packages

npm workspaces monorepo, two packages, one dependency direction:

```
obsidian-plugin/  (private; Obsidian plugin, bundles to main.js at the repo root = plugin folder)
      |  imports only `organic-mindmap` (the public entry; `coreAlias.ts` resolves it to core/src)
      v
core/             (package `organic-mindmap`: library, demo, tests; never imports `obsidian`)
```

`core/src/noObsidianImports.test.ts` guards the direction. `manifest.json` and `versions.json` live at the repo root
because Obsidian's release flow reads them there; `obsidian-plugin/scripts/setup-dev-vault.sh` copies the manifest
next to the bundle. The plugin uses `mountMindmap` (no React in the bundle). The rest of this doc is the library;
paths are relative to `core/`.

## Library entry points

The library has two entry points:

- `organic-mindmap` (`src/index.ts` -> `src/core/`): framework-free TypeScript. **Never imports React**
  (guarded by `src/core/noReactImports.test.ts`).
- `organic-mindmap/react` (`src/react/`): `<Mindmap>` component that mounts the core onto a canvas and
  syncs size / device pixel ratio with a `ResizeObserver`. It mounts in a layout effect before attaching its ref, so a
  non-null ref (`MindmapApi`) is always usable (`e2e/mindmapRef.spec.ts`).

The demo (`demo/`) and E2E tests import only those two names (Vite/Vitest alias in `vite.shared.ts`),
so they prove the public API is sufficient (spec D1).

## Data flow (one paint)

```
host data (flat MindmapNode[])      PartialMindmapConfig        Partial<MindmapExtensions>
          |                                 |                              |
     buildTree()                      resolveConfig()              resolveExtensions()
          v                                 v                              v
   MindmapTree ---------------------> buildScene() <----------------------'
                 resolveNodeSizes() -> runLayoutPipeline(stages) -> colorStrategy.resolve() -> branches
                                            |
                                         Scene
                                            v
                                drawScene(ctx, scene, viewport)   <- RepaintScheduler (1 paint / frame)
```

`mountMindmap(canvas, options)` owns the state (edit session, config, extensions, viewport, view) and the
scheduler; every setter just requests a repaint (spec L8). `CanvasInteractions` picks the scene to paint (pending
preview, else draft child, else host-confirmed data, with the user's position overrides; or the live drag preview),
`drawScene` applies the `ViewController` pan/zoom, then `drawInteractionOverlay` paints hover buttons / drop
highlight / pending veil on top.

**Scene cache:** `buildScene` runs only when data, config, extensions or position overrides are new objects
(`render/sceneCache.ts` = `rememberLast(buildScene)`, one slot per mount). Hover, pan, zoom and the busy animation
repaint with the same four objects and reuse the scene; anything the user should see arrives as a new object (host
data, `resolveConfig` result, the edit preview's data, the overrides map). Derived inputs that would otherwise be
fresh each call (`EditSession.preview`, the draft child and the pending-move overrides in `LocalEditState`) are
themselves remembered by input identity, so a pending edit's busy frames stay cheap. Only the drag preview rebuilds
branches per pointer move, over a frozen base scene.

## Modules (`src/core/`)

| Dir | Owns | Key names |
|---|---|---|
| `model/` | Host data types, tree index, reference data | `MindmapNode`, `buildTree(nodes, sideOrder)` -> `MindmapTree` (depth, side, ancestry), `SideOrder`, `REFERENCE_DATA` |
| `config/` | Plain-data config + defaults + deep merge + settings storage seam | `MindmapConfig`, `DEFAULT_CONFIG`, `resolveConfig`, `ThemeConfig`, `SettingsStorage`, `SettingsPersistence`, `restoreConfig` |
| `size/` | Single source of node sizes (R4) | `resolveNodeSizes(tree, config.node)` -> `NodeSizeMap` |
| `layout/` | Layout `type` union + stage pipeline + bow curve + default stages + user position overrides | `LayoutConfig`, `LayoutStage`, `LayoutContext`, `runLayoutPipeline`, `defaultLayoutStages`, `layoutMindmap`, `BowCurve`, `tidyTreeStage`, `rootBowStage`, `handDrawnJitterStage`, `collisionStage` / `resolveCollisions`, `applyPositionOverrides`, `subtreeMoveTo`, `moveSubtree` |
| `geometry/` | Branch path representation + limb geometry | `BranchPath { length, sampleAt(arcLength) -> { point, tangent } }`, `Branch { path, width }`, `CubicBezierPath`, `buildBranches` (curves + fork + routing), `Box` helpers, `taperedOutline` |
| `shape/` | Node shape seam (R2) | `NodeShape { draw, contains, rimPoint }`, `ellipseShape` |
| `color/` | Color strategy seam (R10/R11) | `ColorStrategy.resolve(tree, theme) -> NodeColorMap`, `parentDerivedColorStrategy` |
| `render/` | Scene assembly, scene cache, canvas drawing, frame coalescing | `buildScene`, `cachedSceneBuilder`, `drawScene`, `drawLabels`, `drawInteractionOverlay`, `RepaintScheduler` |
| `memo/` | Identity memo for the repaint path | `rememberLast(fn)` (previous result while every argument is `===`) |
| `text/` | Font loading + glyph-outline labels (R12-R18, L6) | `LabelFontLoader` / `FontStore` (`FontFetcher` seam), `LoadedFont.shape` / `coversText`, `rimToRimSpan`, `fitBranchText`, `fitNodeText`, `layoutBranchLabel`, `layoutNodeLabel`, `paintLabel`, `paintSystemTextLabel`, `CssFontFaces` (same bytes as DOM font for inline rename and fallback labels) |
| `extensions.ts` | Bundle of code-level extension points | `MindmapExtensions`, `DEFAULT_EXTENSIONS` |
| `edit/` | Request -> confirm protocol (I5), default host (I6) | `EditRequest`, `EditHandler`, `EditSession`, `findEditProblem`, `applyEdit`, `InMemoryHost` |
| `view/` | Library-local pan/zoom (I1) | `MindmapView`, `ViewController` |
| `interaction/` | Canvas pointer interactions (I1-I5) | `CanvasInteractions` (DOM wiring), `PointerGesture` + `DRAG_THRESHOLD_PX` + `clickedNodeId`, `hitTest` (`nodeAt`, `nodeHandles`, `inHoverArea`, `pointerTargetAt`), `editAffordances` (`shownHandles`, `editorAllowed`), `NodeClickEvent`, `NodeContextMenuEvent` + `contextMenuNodeId`, `InlineLabelEditor`, `NoticeBanner`, `ReparentConfirmation` + `ReparentDialog`, `NodeRepositionEvent` |
| `mount.ts` | Imperative entry point | `mountMindmap` -> `MindmapHandle` |

## Config vs extensions

- `MindmapConfig` is **plain serializable data** (theme colors, node sizing, branch width/taper, text
  fonts, layout numbers, interaction behavior such as `interaction.confirmReparent` and the `allowAdd` / `allowRename` / `allowDelete` switches). All optional for hosts; `resolveConfig` deep-merges over `DEFAULT_CONFIG`
  (objects merge, arrays such as the palette are replaced). A settings panel can be generated from its shape.
- `MindmapExtensions` holds **functions/objects** composed in by the host: `layoutStages`
  (`null` = defaults for the configured layout type), `bowCurve`, `nodeShape`, `colorStrategy`.

## Seams and their contracts

- **Layout pipeline** (L5/L7): `LayoutStage.run(positions, context) -> positions` is pure; stages read
  `context.tree`, `context.sizes`, `context.config` (the `LayoutConfig` variant) and `context.bowCurve`.
  `defaultLayoutStages(config)` switches exhaustively on `config.type`; adding a layout `type` means
  extending the union in `layout/layoutConfig.ts` and the switch in `layout/pipeline.ts`.
  Scene coordinates: root at `(0, 0)`, +x right, +y down; the renderer centers the root in the viewport.
  First-level sides come from the tree: explicit `side`, else `layout.sideOrder` splits the unsided nodes in data
  order (`alternating` right/left/right, the default; `clockwise` first half right top to bottom, second half left
  bottom to top, so `tidy-tree` reverses the left side's vertical order). `buildScene` / `layoutMindmap` pass it to
  `buildTree`; structural callers (edits) build without it.
  Bilateral defaults, in order: `tidy-tree` (d3-hierarchy per side, size-aware edge gaps; creates positions),
  `root-bow` (shifts each first-level subtree outward by `bowCurve`), `hand-drawn-jitter` (offset hashed from
  the node id, so deterministic and stable under edits), `collision` (push-apart, root pinned).
  `layoutMindmap(data, { config, extensions })` is the standalone data-in -> positions-out entry (L7).
- **Collision** (R23/I2): `resolveCollisions(positions, { tree, sizes, padding, pinnedGroups })` is reusable outside
  the pipeline. `applyPositionOverrides` pins user-dragged subtrees as groups in drop order: laid-out nodes yield to
  them, and of two overlapping dragged subtrees the earlier drop yields. The root never moves.
- **Bow curve** (R21): `BowCurve(normalizedVerticalDistance 0..1) -> normalizedHorizontalOffset 0..1`.
- **Branch path** (R5/R12): arc-length parametrised so branch rendering (tapered outline) and
  text-along-curve (glyph placement) agree. Branches run center to center (R9); use
  `nodeShape.rimPoint` to find where the limb meets the node rim.
- **Branch geometry** (R5-R9): `buildBranches({ tree, positions, sizes, config.branch })` is pure. Each limb is a
  cubic that leaves the parent horizontally through a fork point shared by all siblings (soft Y), settles
  horizontally into the child, then `branchRouting.ts` nudges its inner control points vertically away from
  unrelated node boxes and from overlapping limbs (simple separation, not physics; curve interior only, since
  clearing an obstacle near an end would bulge the whole limb). Sample-level checks run only for pairs whose
  clearance-inflated bounding boxes overlap (a cubic stays inside its control points' box), which keeps the routed
  shapes identical to a full scan while scaling to ~1,000 nodes; `npm run bench` reports `buildScene` times. `Branch.width` is the
  start/end thickness (`rootWidth * widthPerLevel^(level-1)`, end = `taper` of start); `taperedOutline(branch,
  asymmetry)` turns it into the polygon the renderer fills, with a hash-of-child-id-seeded one-sided bulge (R7);
  its edges are sampled evenly plus wherever the limb bends (cost follows total turning), so tight bends show no corners.
- **Node shape** (R2): `draw` paints fill + outline; `contains` is for hit testing; `rimPoint` for geometry.
- **Color strategy** (R10/R11): returns fill + outline per node id; root colors come from `theme.color.root`.
- **Node sizes** (R4): always read from `Scene.sizes` / `resolveNodeSizes`; never compute sizes elsewhere.
- **Fonts** (L5/L6): `MountOptions.fontFetcher(url) -> Promise<ArrayBuffer>` is the I/O seam (default `fetch`;
  hosts holding bytes return them). `FontStore` loads each URL once; `LabelFontLoader` follows
  `config.text.{node,branch}.url`, repaints on settle and reports `{ node, branch }` status via
  `onFontStatusChange` / `handle.fontStatus()`. A font that is loading or failed is `null` for the paint, so
  its text is skipped, never thrown.
- **Labels** (R12-R17): text is shaped once per font+string into em outlines + advances, then laid out by pure
  functions (`text/labelLayout.ts`) and inked from outlines. Branch labels sit between the
  rims (`rimToRimSpan` bisects `nodeShape.contains` along the `BranchPath`), flip when the path heads left,
  and fit via the R15 cascade in `text/branchTextFit.ts`. Node labels fit via `text/nodeTextFit.ts`: shrink down to
  `text.nodeFit.minFontScale` (default 0 = unlimited, today's look), then cut and end with "…"; the fit is
  measurement-agnostic (glyph runs or `measureText`).
  Fallback (the one R17 exception): a label with a character its font lacks (`LoadedFont.coversText`: glyph 0 by
  code point; whitespace, U+200D and variation selectors never count) is skipped on its branch and drawn on its node
  by `paintSystemTextLabel` with `fillText` and the CSS family list from `CssFontFaces` (label font first, so the
  browser substitutes system fonts only for the missing glyphs: color emoji, CJK, Cyrillic). The mount owns
  `CssFontFaces` and passes the family to `drawScene` as `LabelFallback`; a face becoming usable requests a repaint.
  Fully covered labels render exactly as before. Not bundled: fallback fonts (Noto CJK is many MB, opentype.js has
  no color emoji).
- **Edit protocol** (I5): `EditHandler(request, currentData) -> Promise<MindmapData>`. Resolve with the
  host's updated data (rendered as-is; the library never applies the change to confirmed data, L2); reject
  with an `Error` whose message is a plain-language reason. `EditSession.submit` refuses up front (no request
  sent) when `findEditProblem` objects (self/descendant drop, unknown node, delete root) or another edit is
  pending; view actions stay available. While pending, `preview` is derived from the current confirmed data
  (`add` uses `PENDING_NODE_ID`; `delete` keeps the subtree visible); `rejected` keeps the request for retry.
  No library-side timeout. `applyEdit` is the pure apply used by `InMemoryHost` and the preview.
- **Settings storage**: `SettingsStorage { load(): Promise<unknown>; save(config): Promise<void> }` is the host's
  persistence (Obsidian `loadData`/`saveData`, `localStorage`); the library decides what and when, the host only
  stores it. `SettingsPersistence.load()` runs `restoreConfig` (stored data is untrusted: each `DEFAULT_CONFIG` leaf
  keeps the stored value only if it has the default's type, unknown keys dropped, arrays only whole and same-length,
  unknown `layout.type` -> default layout) and returns defaults when the load fails. `save` is fire-and-forget with one
  write in flight, later changes coalescing into one follow-up write of the latest. Failures are `console.warn`ed,
  never thrown. Opt-in: without it the host just passes `config`.
  Settings the user changes inside the map (the reparent dialog's "Don't ask again") are applied by the mount and
  reported via `onConfigChange(fullConfig)`; the host stores them like panel changes and passes them back as `config`
  (a later `setConfig` replaces them otherwise).
- **View** (I1): `screen = viewportCenter + offset + zoom * scene` (CSS px). `ViewController` reports
  changes it makes (pan, cursor-anchored zoom, API zoom/reset, the initial fit) via `onViewChange`; host `setView` is not echoed
  and, before the first paint, takes precedence over the initial fit.
  Fit-to-content (`view/fitView.ts`): every paint feeds `contentBounds(positions, sizes)` to the controller; the
  first paint on a sized viewport fits the whole map with `FIT_MARGIN_PX` (never above zoom 1) and `reset()`
  returns to that fit. Later data/resize changes leave the view alone.
  `centerOnNode(id)` is applied on the next paint (where the painted scene knows the node's position), after the
  initial fit, so it keeps the zoom; reported like other library changes; an id not on the map does nothing.
- **Pointer interactions** (I1-I5): `CanvasInteractions` is the only DOM-event code; the decisions are pure and
  unit-tested (`PointerGesture`: click vs pan vs node drag past `DRAG_THRESHOLD_PX`; `hitTest`: point -> node /
  hover button, in scene coordinates against the last painted scene; `LocalEditState`: library-local state over
  `EditSession` (position overrides, the draft child, the editor's last request) and what to display, keep or
  reopen as edits go pending / confirmed / rejected). Dragging empty canvas or the root pans; wheel
  zooms at the cursor. A node drag moves its subtree over a frozen scene (no live push-apart, else the drop target
  would be pushed out from under the pointer); dropping onto a node sends `move` (the dragged subtree is never a
  target, so self/descendant drops cannot happen by drag and `findEditProblem` still guards) once the user confirms:
  `ReparentConfirmation` decides and holds the question, `ReparentDialog` asks (Enter confirms, Escape cancels), the
  drop stays frozen on screen and canvas presses are ignored meanwhile, Cancel sends nothing (the map is as before the
  drag); no question when `interaction.confirmReparent` is off. Dropping elsewhere
  stores a library-local `PositionOverrides` entry (offset from the parent) and emits `onNodeReposition` plus
  `onNodeOffsetsChange` (all overrides as plain `NodeOffsets` JSON; hosts restore them via `nodeOffsets` /
  `setNodeOffsets`). `buildScene(..., overrides)` applies overrides after the pipeline, parents first, each at its
  offset from the parent's placed centre (`Scene.placedPositions`: before the push-apart, so a pushed parent never
  shifts a saved offset), and re-runs `resolveCollisions` with the overridden subtrees pinned in drop order (no
  overrides = pipeline output untouched). Descendants' offsets travel with a drop (negated `dx` when it mirrors), and a
  confirmed `move` drops the moved subtree's overrides (reported too). Crossing the parent's centre line mirrors the
  subtree around the dragged node:
  `subtreeMoveTo` is the single flip rule used by the drag preview, the stored drop and `applyPositionOverrides`.
  Hover buttons: "+" on the outer side (both sides for the root) opens the inline editor on a local draft child
  (`DRAFT_NODE_ID`, not sent until Enter). While they show, the hovered node keeps its hover over its hover area
  (rectangle around its box and buttons, target `near-handles`), so the pointer can cross the gap to the "+";
  pressing there pans. No delete button: hosts send `delete` from their own UI. Double-click renames. Editors
  do not open while an edit is pending. `interaction.allowAdd` / `allowRename` off hide the "+" (`shownHandles`) and
  keep the editor shut (`editorAllowed`), giving a move-only map; `allowDelete` is reserved for a future in-map
  delete control. The switches gate only the map's own controls, never the host's `requestEdit`.
  Node clicks (`onNodeClick`, `NodeClickEvent` with node id + DOM modifier keys): a press released within the drag
  threshold on a node, the root included (pressing it still pans: press target `fixed-node`). Hover buttons, their
  hover area and bare canvas are not node clicks (`clickedNodeId`). Click rule: every click is reported at once, so a
  double-click is two clicks plus the rename when renaming is on. WHY-NOT delay clicks by the double-click
  interval: it lags every navigation click, while jumping to the same place twice is harmless (and move-only maps
  have no rename anyway). Node right-clicks (`onNodeContextMenu`, `NodeContextMenuEvent` with node id + client point,
  spec I11): only a real node under the pointer reports and suppresses the browser's menu (`contextMenuNodeId`), and
  only while the hook is set; bare canvas, the "+" and preview/draft nodes keep the browser's menu. The library draws
  no menu: hosts show their own and send `delete` via `requestEdit`. Host highlight (`setHighlightedNode`): a ring
  in `theme.color.highlight` painted by the overlay, so it never rebuilds the scene; an unknown id draws nothing. DOM overlays (`<input>` editor, `role="alert"` notice with the rejection or
  refusal reason, `role="dialog"` reparent question) are created lazily as siblings right after the canvas, positioned via `offsetLeft/Top`. A
  rejected edit sent from the editor reopens it with the typed label (I5.4).
  `MindmapHandle.getNodeScreenBox` / `getData` expose node boxes and confirmed data (host UI, E2E).

## Demo runner (`demo/`, spec §6a)

A host built only on the public API (D1). `index.html` is the runner; `reference.html` is the canvas-only acceptance
page and loads none of the runner code or CSS.

- `host/demoHost.ts` (`useDemoHost`): owns the data in React state like a real host (L2) and answers edits with the
  library's `InMemoryHost`, whose delay/reject the "Host simulation" controls set (D4/D5). `replaceMap(data)` swaps
  the data and remounts `<Mindmap>` via `key` (clears dragged positions and the view); answers to requests sent
  before it are dropped. "Reset map" (D6) is `replaceMap(REFERENCE_DATA)`. A node click (I7) highlights that node
  (I8) and shows the readout from `host/nodeClickReadout.ts`.
- "Load 200-node map" shows `syntheticTree(200)` (the bench's generator) through `replaceMap`, to feel performance.
- `markdown/` (D7): "Paste Markdown" turns a note's headings into map data (`headingMapData`) and shows it through
  `replaceMap`. Throwaway glue that mirrors the plugin's mapping; the plugin uses Obsidian's heading list, and
  `src/` stays Markdown-free.
- `settings/` (D3): the panel is derived from `DEFAULT_CONFIG`'s shape (`settingsModel.ts`), so a new config leaf gets
  a control without panel code. Numbers need a slider range in `settingSpecs.ts` `NUMBER_RANGES`, a `Record` over
  every numeric config path, so a new number does not compile until it has one. The runner passes the full
  `MindmapConfig` as `config`; "Reset settings" puts `DEFAULT_CONFIG` back. `usePersistedConfig` loads the settings
  through `SettingsPersistence` over `LocalStorageSettings` before the runner renders and saves every change, including
  the map's own `onConfigChange`.

## Testing

- Unit (Vitest, node env, BDD naming): pure logic (core modules and the demo's settings/host logic) has a sibling
  `*.test.ts`.
- Bench (`npm run bench`, `bench/*.bench.ts` under `bench/vitest.bench.config.ts`): prints `buildScene` timings for
  synthetic trees (`test-support/syntheticTree.ts`, 50/200/500/1,000 nodes). A report only, never a gate, and not
  part of `npm test`. DOM and canvas wiring (`CanvasInteractions`, DOM overlays, canvas drawing, React) is kept thin and
  covered by E2E plus the acceptance screenshot instead; when such wiring grows a decision, move it into a pure unit.
  `npm run coverage` reports unit coverage (no threshold gate).
- E2E (Playwright, Chromium): `e2e/` runs against the built demo served by `vite preview`. Import `test`
  from `e2e/fixtures.ts`: it aborts non-localhost requests and serves `*.ttf` from the vendored font.
  Canvas content has no DOM, so the demo exposes its `MindmapApi` as `window.mindmap` (`demo/testHooks.ts`); shared
  page helpers live in `e2e/demoPage.ts`. Settings controls carry `data-testid="setting:<dotted.config.path>"`.
- Acceptance screenshot (spec Q3): `e2e/reference-view.spec.ts` shoots `demo/reference.html`, a canvas-only
  page (zero config, reference data, no React) at a fixed 1400x900 / DPR 1 viewport; the baseline lives in
  `e2e/reference-view.spec.ts-snapshots/`. It is the only look assertion in the repo; re-baseline (from `core/`) with
  `npx playwright test e2e/reference-view.spec.ts --update-snapshots` after an intended visual change.
- Vendored Kalam (`assets/fonts/kalam/`, SIL OFL) is the same file as the default Fontsource URL; unit tests
  read it via `test-support/vendoredKalam.ts`, so no test hits the network.

## Obsidian plugin (`obsidian-plugin/`)

- `src/main.ts` is the Obsidian entry (`Plugin` subclass). Logic goes into sibling modules that do not import
  `obsidian` (e.g. `commands.ts`, `statusMessage.ts`) so Vitest covers them without an Obsidian runtime
  (`obsidian` is a types-only package outside the app).
- `src/mindmapNote/` is the mindmap note format (`next-steps-prior-to-obsidian.md` "Phase 1a"), text in, text out:
  `isMindmapNote`, `readMindmapNote` (note -> `MindmapNote`: nodes, saved parent offsets, or a plain-language
  problem), `MindmapNote.applyEdit` / `setPositions` (new note text, changing only the touched lines;
  `setPositions` writes the whole offsets set the map reports and drops ids not in the list; `move` and `delete`
  drop the branch's saved offsets in the same write, so Undo restores them with the branch), and
  `newMindmapNoteText`. It parses the text itself (WHY-NOT the metadata cache: it lags behind typing and is missing
  in unit tests). Ids generated for items without a block id only exist in that read and reach the file with the
  next write, so writes always go through the `MindmapNote` the map was drawn from.
- `src/mapView/` is the map of one mindmap note. `MindmapNoteView` (a `FileView`, the only file importing
  `obsidian` besides `main.ts`) mounts `mountMindmap` on a canvas, re-reads the note on every `vault` `modify` of its
  file (overlapping re-reads: only the newest loads), and answers `onEditRequest` through `MindmapNoteSession` (`noteSession.ts`, pure): one `vault.process`
  per edit that applies `MindmapNote.applyEdit` only when the file still holds the text the map was drawn from,
  else reloads and refuses with `STALE_EDIT_REASON` (generated ids resolve only within one read; a stale write could
  drop what was typed meanwhile). Session writes run one after another, so a drop saved while an edit is still
  writing checks against that edit's text. When the view switches to another file (or closes) it closes the session:
  writes already queued for the old note still finish against its file (stale-checked; dropping them would lose a
  drag made right before the switch), but reject with `NoteClosedError` instead of loading into the next note's map. Saved positions: the map mounts with the note's offsets
  (`nodeOffsets`), every `onNodeOffsetsChange` goes through the same stale-checked write (`savePositions`), and a
  change from outside the map also resets the map's offsets to the note's. Delete: `onNodeContextMenu` opens an
  Obsidian `Menu` whose "Delete" calls `requestEdit` (the library refuses the root up front; the view shows the
  reason as a `Notice`); a confirmed delete shows a `Notice` with "Undo" (the same undo as Ctrl+Z). Undo/redo
  (`editHistory.ts`, pure): the view's scope (`new Scope(app.scope)`, active only while the view is the active one)
  binds Mod+Z / Mod+Shift+Z; every confirmed write's `WriteSnapshot` (before/after note text) is one step on
  `EditHistory`, and the positions write the library reports with `cause: 'confirmedMove'` folds into the move's
  step (`recordInLastStep`), so one person action is one Ctrl+Z; a write that left the text unchanged is no step.
  `MindmapNoteSession.undo`/`redo` swap the step's texts through the write queue only while the file holds the text
  the step left; otherwise the view clears the history (every later step builds on that text) and says so in a
  `Notice`. While a text field or dialog has focus (`textEntryFocus.ts`), the keys are left to it (native undo). WHY-NOT
  `TextFileView`: it saves its own text on its own schedule, which could overwrite a newer file. Each view owns its session and mount, so two open maps share nothing.
  Routing (`viewSwitch.ts`, pure decision + per-leaf `MarkdownChoices`; wired in `main.ts`): `WorkspaceLeaf.setViewState`
  is wrapped (the Kanban/Excalidraw approach) so a `markdown` request for a note whose text passes `isMindmapNote`
  opens the map view instead, unless the user chose "Open as Markdown" for that note in that leaf. Detection by
  file text, not by name or metadata cache, so there is one rule and no indexing lag. The wrap itself is
  `viewRouting.ts` over `monkey-around` (what Kanban uses): unloading restores the original only when ours is
  still the outermost wrapper, else ours stays as a pass-through, so another plugin's later wrap survives our unload.
  Node clicks open the first `[[link]]` of the item (`linkTarget.ts`) via `workspace.openLinkText`. Fonts:
  `bundledFonts.ts` inlines the library's published Kalam subpath (`organic-mindmap/fonts/kalam-latin-400-normal.ttf`,
  esbuild `binary` loader) behind the library's `fontFetcher` seam (`fontBytes.ts`, rejects any URL that is not
  bundled), so the plugin never fetches from a CDN and still imports only the library's public entry points.
- Obsidian E2E (`npm run test:e2e:obsidian`, `e2e/*.e2e.ts`): `scripts/run-e2e.sh` provisions a pinned Obsidian
  (`scripts/setup-obsidian-bin.sh`, Linux download into `.tmp/obsidian-e2e/bin/`, or `OBSIDIAN_PATH`), seeds
  `.dev-vault/` with the built plugin, then `e2e/obsidianHarness.ts` spawns Obsidian on a throwaway copy of the vault
  with an isolated `--user-data-dir`, attaches over CDP (not `_electron.launch`), seeds the window size, enables the
  plugin at runtime, pins the Obsidian settings the journeys rely on (`alwaysUpdateLinks`) and exposes `openFile` /
  `runCommand` / `hasCommand` / `relaunch`. The mechanics are documented in the harness; keep them. The map has no DOM,
  so specs read it through the active view's `mapHandle` (the library handle); pointer journeys click positions computed
  from it, so one spec asserts the canvas bitmap equals its CSS box times `devicePixelRatio` (else the drawn map is
  scaled away from where clicks are hit-tested and the computed positions prove nothing). Specs never import plugin
  modules that import `obsidian`. Key journeys only, no look assertions; one Obsidian per spec file, serial.

