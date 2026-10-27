# Organic Mindmap (Obsidian plugin)

Mindmaps for [Obsidian](https://obsidian.md) that feel hand-drawn: organic branches, glyph-outline labels along
them, a tidy bilateral layout that does not look machine-made.

**Status: in development, not released.** Desktop only. Plan: [next-steps-prior-to-obsidian.md](next-steps-prior-to-obsidian.md).

## Mindmap notes

A mindmap is a normal Markdown note flagged `organic-mindmap: 1` in its frontmatter. Its nested list is the tree
(one top-level item = the root), and each item's block id (`^n7f3k`) is the node id:

```markdown
---
organic-mindmap: 1
---
- Project Phoenix ^root
	- [[Some note]] ^n7f3k
		- plain idea ^n9a2b
```

- **Create:** command "Create new mindmap" makes `Mindmap <timestamp>.organic-mindmap.md` in your default new-note
  folder and opens it as a map. Or add the frontmatter flag to any note with one top-level list.
- **Open:** a flagged note opens as a map wherever you open it (file explorer, links, quick switcher). The map's
  "..." menu has "Open as Markdown"; command "Toggle mindmap / Markdown view" switches either way.
- **Edit on the map:** hover a node for "+" (add child), double-click to rename, drag onto another node to move it
  there. Every change is written to the note at once; edits typed in a Markdown tab (or synced in) show up on the
  open map.
- **Positions:** drag a node to empty space and it stays there: the spot is saved in the note (as an offset from its
  parent, in a hidden `%%` layout block) and comes back when you reopen the note. Nodes you never dragged keep the
  automatic layout.
- **Delete:** right-click a node > "Delete" removes it and its nested items from the note. The notice that follows
  has "Undo". The root cannot be deleted.
- **Undo / redo:** Ctrl+Z (Cmd+Z) undoes the last map change, Ctrl+Shift+Z (Cmd+Shift+Z) redoes it; one action
  (add, rename, move, delete, drag) is one step. Steps apply as long as the note has not changed outside the map
  (typing in a Markdown tab, sync); after that the map's history is gone and a notice says so. The history lives
  with the open map: switching the view to another note or closing it drops it.
- **Links:** an item that contains a `[[link]]` shows the link's text and opens it on click (Ctrl/Cmd-click: new
  tab). Since the mindmap is a normal note, Obsidian keeps its links updated when a linked note is renamed.
- A note the plugin cannot read as a map says why and offers "Open as Markdown".
- **Settings** (Settings > Organic Mindmap): branch colors (Warm, Vivid, Muted, Monochrome), node font and branch font
  (Kalam, Caveat, Patrick Hand, Nunito), background color, and "Restore look defaults". Changes apply to every open
  map at once and survive restarts.
- No network: every font is bundled (SIL OFL; licenses next to the TTFs in `core/assets/fonts/` and
  `obsidian-plugin/assets/fonts/`).

## Install from source (for now)

```bash
npm install
npm run build                 # builds the library and main.js at the repo root
```

The repo root is the plugin folder (`main.js`, `manifest.json`, `styles.css`). Link it into your vault, then enable
"Organic Mindmap" under Settings > Community plugins:

```bash
ln -s "$PWD" "<your vault>/.obsidian/plugins/organic-mindmap"
```

`npm run dev:plugin` rebuilds `main.js` on every source change; reload the plugin in Obsidian to pick it up. Or
`npm run setup:dev-vault` and open `obsidian-plugin/.dev-vault/` as a vault (the plugin is already installed there).

## Repo layout

npm workspaces monorepo:

| Package | Path | What |
|---|---|---|
| `organic-mindmap` | [`core/`](core/README.md) | The mindmap library (framework-free core + React wrapper), its demo and tests. Usable on its own; knows nothing about Obsidian. |
| plugin | `obsidian-plugin/` | The Obsidian plugin, built on the library's public API. Bundles to `main.js` at the repo root; the repo root is the plugin folder (`main.js`, `manifest.json`, `styles.css`, `versions.json`). |

Requirements: [spec.md](spec.md). Architecture: [docs/architecture.md](docs/architecture.md).

## Develop

```bash
npm install                     # deps for both packages + Playwright Chromium
npm run typecheck && npm test   # both packages (Vitest unit tests)
npm run build                   # library to core/dist/ and plugin to obsidian-plugin/main.js
npm run build:plugin            # plugin only; `npm run dev:plugin` rebuilds on change
npm run e2e                     # library demo E2E (Playwright, Chromium)
npm run test:e2e:obsidian       # plugin E2E in a REAL Obsidian (see below)
```

### Plugin E2E in a real Obsidian

`npm run test:e2e:obsidian` builds the plugin, seeds `obsidian-plugin/.dev-vault/`, boots a real Obsidian (Electron)
on a throwaway copy of that vault and drives it with Playwright over CDP. Not part of `npm test` (slow; a release
gate). Runs headless on a display-less Linux box: the first run downloads a pinned Obsidian (`OBSIDIAN_VERSION` in
`obsidian-plugin/scripts/setup-obsidian-bin.sh`) into git-ignored `.tmp/obsidian-e2e/bin/`.

```bash
npm run test:e2e:obsidian                       # Linux: downloads Obsidian once, headless if no display
npm run test:e2e:obsidian -- smoke.e2e.ts        # one spec
OBSIDIAN_PATH='/Applications/Obsidian.app/Contents/MacOS/Obsidian' npm run test:e2e:obsidian   # macOS / your own binary
```

Env: `OBSIDIAN_PATH` (use this binary, skips the download), `OBSIDIAN_VERSION` (download another build for one run),
`OBSIDIAN_CACHE_DIR` (share one download across checkouts), `OBSIDIAN_E2E_EXTRA_ARGS` (Chromium flags; defaults to
headless flags when no display).
