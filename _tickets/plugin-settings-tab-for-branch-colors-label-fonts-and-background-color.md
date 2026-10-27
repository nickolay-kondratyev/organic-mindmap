---
id: nid_3dc4tbkt1il822ulzdmloxna1_e
title: "Plugin: settings tab for branch colors, label fonts and background color"
status: in_progress
deps: []
links: []
created_iso: 2026-10-27T15:11:07Z
status_updated_iso: 2026-10-27T15:12:36Z
type: feature
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [map-polish]
profile: higher
---


## Goal
Let a person change the key look of their maps from Obsidian's settings: branch colors, label fonts and background color. Today the plugin passes no config, so every map has the library defaults (dark navy background, Kalam, default palette) with no way to change them.

## Done criteria
- An "Organic Mindmap" tab in Obsidian settings (native `Setting` controls) with, in this order:
  - **Branch colors**: a dropdown of a few named palette presets (the current default plus ~3 more, e.g. pastel, vivid, monochrome). Each preset is a full palette of the default's length with fill + outline shades and passes a quick legibility check with white label text.
  - **Node font** and **Branch font**: dropdowns of a few bundled fonts (Kalam stays the default, plus ~3 more SIL OFL fonts, e.g. one more handwritten and one clean sans). Latin subset TTFs, vendored into the repo with their license file like `core/assets/fonts/kalam/`. The plugin bundle must stay offline (no CDN fetch).
  - **Background color**: a color picker.
  - **Reset to defaults** button.
- Changes apply to every open map immediately (`MindmapHandle.setConfig`) and persist across Obsidian restarts.
- Persistence follows the library convention (`docs/architecture.md` "Settings storage"): the plugin stores the config through the library's `SettingsPersistence` over Obsidian `loadData` / `saveData` (untrusted stored data is restored over defaults by `restoreConfig`). The map's own `onConfigChange` (reparent dialog "Don't ask again") is stored the same way, so it now survives restarts too.
- A stored font that the plugin does not bundle (hand-edited `data.json`) falls back to the default font instead of failing to draw labels.
- Unit tests (modules without `obsidian` import): preset -> palette mapping, which preset a stored palette shows as (a palette matching no preset shows as e.g. "Custom" and is kept), font choice -> config URLs, bundled-font fallback. Obsidian E2E: change one setting (e.g. background color) -> an open map's `mapHandle` reports the new config, and it survives `relaunch`.
- README (plugin-first) mentions the settings; `docs/architecture.md` plugin section updated.

## Context
- Use the `obsidian-settings` skill for the tab and the `my-frontend-design` skill for presets/colors.
- Library: `MindmapHandle.setConfig`, `MountOptions.onConfigChange` (`core/src/core/mount.ts`); `SettingsStorage` / `SettingsPersistence` / `restoreConfig` (`core/src/core/config/`); theme in `core/src/core/config/theme.ts` (`theme.color.background`, `theme.color.palette` array of `{ fill, outline }`, arrays replace on merge); fonts in `core/src/core/config/config.ts` (`text.node.url`, `text.branch.url`, default `KALAM_TTF_URL`).
- Plugin fonts: `obsidian-plugin/src/mapView/bundledFonts.ts` maps font URL -> bytes (today only Kalam, via the library's published subpath `organic-mindmap/fonts/kalam-latin-400-normal.ttf`); `obsidian-plugin/src/mapView/fontBytes.ts` rejects unbundled URLs; esbuild `.ttf` `binary` loader in `obsidian-plugin/esbuild.config.mjs`. `main.js` is ~560 KB today; keep each added font a latin subset (~50-150 KB).
- Plugin mounts maps in `obsidian-plugin/src/mapView/MindmapNoteView.ts` `mount` (no `config` passed today); plugin entry `obsidian-plugin/src/main.ts`.
- Related open decision `nid_kkm4447dku0vlz0ry1zwr2v8k_e` (where the full settings screen lives). This ticket does not settle it: it exposes only a few hand-picked settings in a native tab, which fits its recommended option (b) and does not block it.

## Constraints
- Presets and font choices are plugin-side UI over the library config (the library stays Markdown/Obsidian-free). If presets turn out useful to the demo too, put them in the library's public API instead; implementer's call, report it.

## Non-goals
- No full settings panel (every config leaf) in Obsidian; that is `nid_kkm4447dku0vlz0ry1zwr2v8k_e`.
- No custom per-color pickers for the palette, no fonts from the vault or system fonts (glyph-outline labels need font bytes). Follow-ups only if the human asks.
- No "follow Obsidian light/dark theme" automation.
