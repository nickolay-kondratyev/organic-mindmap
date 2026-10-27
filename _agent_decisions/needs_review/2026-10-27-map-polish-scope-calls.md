# map-polish: scope calls made while ticketing (2026-10-27)

Tickets tagged `map-polish`. Calls made without the human; reply to change any.

1. **"+" on both sides** (`nid_8ldir8fohuk5xcwue8ej8noex_e`): for non-root nodes both "+" do the same thing (add a child); the layout decides where the child goes. The root keeps its left/right meaning.
2. **Link look** (`nid_zk9gr2bj43l18yexsa0lsru28_e`): read "show that this was a note that was added" as "nodes that are `[[links]]` look like links". Recommended look: underline + link color, decided with the frontend-design skill. Unresolved links get no special look.
3. **Undo/redo** (`nid_x9jc2ml9mws9tn4l013zuc68r_e`): judged simple enough to do (every map change is already one before/after text write; delete already has a one-step undo). Scope: in-memory, per open map, dropped when the note changes from outside the map.
4. **Settings** (`nid_3dc4tbkt1il822ulzdmloxna1_e`):
   - Read "changing the background font" as **background color**.
   - Branch colors = a few named palette presets (no per-color pickers).
   - Fonts = a few bundled OFL fonts in a dropdown (no vault/system fonts: labels are drawn from font bytes, and the plugin stays offline). Adds roughly 50-150 KB per font to `main.js`.
   - Native Obsidian settings tab with only these settings. Does not settle `nid_kkm4447dku0vlz0ry1zwr2v8k_e` (full settings screen).
