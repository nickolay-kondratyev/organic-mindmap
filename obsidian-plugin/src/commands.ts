/**
 * Command ids and names, kept free of `obsidian` imports so unit tests and the E2E specs can import them
 * (the `obsidian` package is types-only outside Obsidian).
 */
export const SHOW_STATUS_COMMAND = { id: 'show-status', name: 'Show plugin status' } as const;
