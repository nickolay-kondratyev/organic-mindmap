# organic-mindmap (library)

Mindmap library for the web that feels hand-drawn: framework-free TypeScript core plus a thin React wrapper. The
[Organic Mindmap Obsidian plugin](../README.md) is built on it. Requirements live in [spec.md](../spec.md);
architecture in [docs/architecture.md](../docs/architecture.md).

## Use

```tsx
import { REFERENCE_DATA } from 'organic-mindmap';
import { Mindmap } from 'organic-mindmap/react';

<Mindmap data={REFERENCE_DATA} config={{ theme: { color: { background: '#101418' } } }} />;
```

Without React: `mountMindmap(canvas, { data })` returns a handle with `setData`, `setConfig`, `setExtensions`, `resize`, `destroy`.

Structural edits (`move`, `add`, `rename`, `delete`) go to the host's `onEditRequest(request, currentData)`, which
resolves with the host's updated data (rendered as-is) or rejects with a plain-language reason; without one, the
in-memory host confirms immediately. Pan/zoom is library-local: `getView`/`setView`/`zoomIn`/`zoomOut`/`resetView`
on the handle (or the `<Mindmap ref>`), user changes reported via `onViewChange`.

Navigation hooks: `onNodeClick({ nodeId, ctrlKey, metaKey, altKey, shiftKey })` on every click on a node;
`onNodeContextMenu({ nodeId, clientPoint })` on a right-click on a node, to open the host's own menu (e.g. delete via
`requestEdit`; the browser's menu is suppressed on nodes only while it is set);
`setHighlightedNode(id | null)` rings a node; `centerOnNode(id)` pans to it. `interaction.allowAdd` /
`allowRename: false` give a move-only map. Heading-friendly options: `layout.sideOrder: 'clockwise'` (document
order), `text.nodeFit.minFontScale` (long labels end with "…"). Labels with characters the font lacks (emoji, CJK)
fall back to system fonts on the node. Changes per version: [CHANGELOG.md](CHANGELOG.md).

Saved positions: every drop of a dragged node calls `onNodeOffsetsChange(offsets)` with all user-placed nodes as
offsets from their parent, e.g. `{ "n7f3k": { "dx": 120, "dy": -40 } }` (a confirmed reparent clears the moved
branch and reports too). Save that object as-is and hand it back as `nodeOffsets` (mount option or `<Mindmap>` prop;
`setNodeOffsets(offsets)` on the handle) to restore the layout. Offsets are relative, so a node still sits next to
its parent after the auto layout moves the parent; ids not on the map and entries without numeric `dx`/`dy` are
ignored. `onNodeReposition({ nodeId, position })` still reports each drop as an absolute scene point.

Fonts: labels use Kalam, fetched by default from the CDN URLs in the config (`text.node.url`, `text.branch.url`).
Hosts that must not touch the network pass `fontFetcher(url) => Promise<ArrayBuffer>` (mount option) and serve the
bundled copy the package publishes at `organic-mindmap/fonts/kalam-latin-400-normal.ttf` (SIL OFL,
`assets/fonts/kalam/OFL.txt`); it is the same build the default URLs point at.

## Demo runner

```bash
./run.sh            # from the repo root: installs deps if needed, then serves http://localhost:5173 (PORT=... to change)
```

Starts on the Shakespeare reference map with default settings. The side panel has:
- **Map**: zoom / fit buttons, "Reset map" back to the reference data. Edit on the canvas: hover a node for `+` (add
  child), double-click to rename, drag onto another node to make it a child there
  (asks first; "Don't ask again" can be undone under Settings > Interaction), right-click to delete (the demo host's
  own menu). Clicking a node highlights it and shows what the host was told.
- **Paste Markdown**: paste a note and show its headings as the map (root = the single H1, else "Pasted note").
- **Host simulation**: make the in-memory host answer slowly or reject every change, to see pending and rejected edits.
- **Settings**: live controls for every config value (colors, node size incl. the depth scale, branches, text and
  fonts, layout, interaction) and "Reset settings".

## Develop

Run from inside `core/`, or from the repo root (root scripts delegate here; `npm test` / `npm run typecheck` /
`npm run build` there cover the plugin too).

```bash
npm run dev         # demo on http://localhost:5173 (PORT=... to change)
npm run typecheck && npm test && npm run build   # build = library to dist/
npm run e2e         # builds the demo, serves it on E2E_PORT (default 4173), runs Playwright (Chromium)
```
