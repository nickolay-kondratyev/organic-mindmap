/**
 * Command ids and names, kept free of `obsidian` imports so unit tests and the E2E specs can import them
 * (the `obsidian` package is types-only outside Obsidian).
 */
export const SHOW_STATUS_COMMAND = { id: 'show-status', name: 'Show plugin status' } as const;
export const CREATE_MINDMAP_COMMAND = { id: 'create-mindmap-note', name: 'Create new mindmap' } as const;
/** On a map: open the note as Markdown; on a mindmap note in the editor: open it as a map. */
export const TOGGLE_MINDMAP_VIEW_COMMAND = { id: 'toggle-mindmap-view', name: 'Toggle mindmap / Markdown view' } as const;
