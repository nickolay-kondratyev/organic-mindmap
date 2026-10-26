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
`setHighlightedNode(id | null)` rings a node; `centerOnNode(id)` pans to it. `interaction.allowAdd` /
`allowRename: false` give a move-only map. Heading-friendly options: `layout.sideOrder: 'clockwise'` (document
order), `text.nodeFit.minFontScale` (long labels end with "…"). Labels with characters the font lacks (emoji, CJK)
fall back to system fonts on the node. Changes per version: [CHANGELOG.md](CHANGELOG.md).

## Demo runner

```bash
./run.sh            # from the repo root: installs deps if needed, then serves http://localhost:5173 (PORT=... to change)
```

Starts on the Shakespeare reference map with default settings. The side panel has:
- **Map**: zoom / fit buttons, "Reset map" back to the reference data. Edit on the canvas: hover a node for `+` (add
  child), double-click to rename, drag onto another node to make it a child there
  (asks first; "Don't ask again" can be undone under Settings > Interaction). Clicking a node highlights it and
  shows what the host was told.
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
