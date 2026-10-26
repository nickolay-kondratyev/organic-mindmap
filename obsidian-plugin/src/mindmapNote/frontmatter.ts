import { formatListItemLine, toSingleLine } from './listItemLine';

const FRONTMATTER_DELIMITER = '---';
const BYTE_ORDER_MARK = '﻿';
/** `organic-mindmap: 1` (format version 1), the value optionally quoted, an optional trailing YAML comment. */
const MINDMAP_FLAG = /^organic-mindmap[ \t]*:[ \t]*(["']?)1\1[ \t]*(?:#.*)?$/;
/** Block id of the root item in a new note. */
export const NEW_NOTE_ROOT_BLOCK_ID = 'root';

interface Frontmatter {
  /** The YAML lines between the delimiters. */
  readonly lines: readonly string[];
  /** Index of the first line after the closing delimiter. */
  readonly bodyStart: number;
}

/** The note's frontmatter: a `---` first line up to the next `---` line; `null` when there is none. */
export function findFrontmatter(lines: readonly string[]): Frontmatter | null {
  const first = lines[0];
  if (first === undefined || first.replace(BYTE_ORDER_MARK, '').trimEnd() !== FRONTMATTER_DELIMITER) return null;
  const closing = lines.findIndex((line, index) => index > 0 && line.trimEnd() === FRONTMATTER_DELIMITER);
  return closing === -1 ? null : { lines: lines.slice(1, closing), bodyStart: closing + 1 };
}

/** True when the note's frontmatter carries `organic-mindmap: 1`, so it opens as a mindmap. */
export function isMindmapNote(text: string): boolean {
  const frontmatter = findFrontmatter(text.split(/\r?\n/));
  return frontmatter !== null && frontmatter.lines.some((line) => MINDMAP_FLAG.test(line.trimEnd()));
}

/** Content for a new mindmap note: the flag and one root item. */
export function newMindmapNoteText(rootText: string): string {
  const rootLine = formatListItemLine('- ', toSingleLine(rootText), NEW_NOTE_ROOT_BLOCK_ID);
  return `${FRONTMATTER_DELIMITER}\norganic-mindmap: 1\n${FRONTMATTER_DELIMITER}\n${rootLine}\n`;
}
