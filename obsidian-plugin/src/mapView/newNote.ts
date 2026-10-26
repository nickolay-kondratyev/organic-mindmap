/** Marks the file as a mindmap in the file explorer; detection still goes by the frontmatter flag, not the name. */
export const MINDMAP_FILE_SUFFIX = '.organic-mindmap.md';
/** Root item text of a newly created mindmap note. */
export const NEW_NOTE_ROOT_TEXT = 'Central topic';

/**
 * `Mindmap 2026-10-26 23.05.14.organic-mindmap.md`, in local time. Dots instead of colons in the time: colons
 * are not allowed in Windows file names (same scheme as Excalidraw's `Drawing <timestamp>.excalidraw.md`).
 */
export function newMindmapNoteFileName(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  return `Mindmap ${date} ${time}${MINDMAP_FILE_SUFFIX}`;
}

/** The vault path of a new note in `folderPath` (Obsidian gives the vault root as `/`). */
export function newNotePath(folderPath: string, fileName: string): string {
  const folder = folderPath.replace(/^\/+|\/+$/g, '');
  return folder === '' ? fileName : `${folder}/${fileName}`;
}
