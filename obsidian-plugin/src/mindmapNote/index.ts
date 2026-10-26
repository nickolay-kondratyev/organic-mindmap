/**
 * The mindmap note format (one Markdown note per map, see next-steps-prior-to-obsidian.md "Phase 1a"): detect,
 * read, and write map edits back as minimal text changes. Pure text in, text out; never imports `obsidian`, so it
 * is unit-tested here and usable from Obsidian E2E specs.
 */
export type { BlockIdSource } from './blockId';
export { isMindmapNote, newMindmapNoteText } from './frontmatter';
export { LAYOUT_BLOCK_LANGUAGE, type NodeOffset, type NodeOffsets } from './layoutBlock';
export { MindmapNote, type NoteNode, type NoteWriteResult } from './mindmapNote';
export { NOTE_PROBLEM, readMindmapNote, type NoteReadResult } from './readMindmapNote';
