import type { MindmapData, MindmapNode, NodeId } from 'organic-mindmap';

/**
 * Demo-only glue (spec D7): turns pasted Markdown into a heading map the way the Obsidian plugin will. The plugin
 * reads Obsidian's own heading list instead, so this parser is deliberately small (duplication is fine; the library
 * stays Markdown-free).
 *
 * Known ceiling: ATX headings (`# Title`) only. WHY-NOT setext headings (`Title` over `===`): rare in notes, and
 * telling them from a table rule or a YAML block needs paragraph tracking this throwaway parser does not need.
 */

/** The demo has no file name, so the root is this fixed title unless the note has exactly one H1. */
export const PASTED_NOTE_TITLE = 'Pasted note';

export const HEADING_MAP_ROOT_ID: NodeId = 'note';

const TOP_LEVEL = 1;

export interface MarkdownHeading {
  /** 1 for `#`, up to 6 for `######`. */
  readonly level: number;
  readonly text: string;
}

/**
 * `^ {0,3}`: up to three spaces of indent (four or more is an indented code block).
 * `(#{1,6})`: the level. `(?:[ \t]+(.*?))?`: the text after at least one space, so `#tag` is not a heading.
 * `(?:[ \t]+#+)?[ \t]*$`: an optional closing `#` run and trailing spaces, both dropped.
 */
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;

/** `^ {0,3}`: indent as above. `(`{3,}|~{3,})`: the fence run, whose character and length the closing fence must match. */
const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})/;

const FRONTMATTER_DELIMITER = '---';

/** Headings in document order; `#` lines inside fenced code blocks and YAML frontmatter are not headings. */
export function parseHeadings(markdown: string): MarkdownHeading[] {
  const lines = markdown.split(/\r?\n/);
  const headings: MarkdownHeading[] = [];
  let openFence: string | null = null;
  for (const line of lines.slice(frontmatterEnd(lines))) {
    const fence = CODE_FENCE.exec(line)?.[1] ?? null;
    if (openFence !== null) {
      if (fence !== null && fence.charAt(0) === openFence.charAt(0) && fence.length >= openFence.length) openFence = null;
      continue;
    }
    if (fence !== null) {
      openFence = fence;
      continue;
    }
    const heading = ATX_HEADING.exec(line);
    const marks = heading?.[1];
    if (marks !== undefined) headings.push({ level: marks.length, text: heading?.[2] ?? '' });
  }
  return headings;
}

/** Index of the first line after a leading `---` YAML block (whose `# comments` are not headings), else 0. */
function frontmatterEnd(lines: readonly string[]): number {
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) return 0;
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === FRONTMATTER_DELIMITER);
  return closing === -1 ? 0 : closing + 1;
}

interface OpenHeading {
  readonly level: number;
  readonly id: NodeId;
}

/**
 * Map data for a note: the root is `noteTitle`, or the single H1 when there is exactly one. Each heading's parent is
 * the nearest heading above it with a lower level (so skipped levels attach to that heading), else the root. Text
 * before the first heading is ignored. Sides are left unset, so `layout.sideOrder` decides them.
 */
export function headingMapData(markdown: string, noteTitle: string = PASTED_NOTE_TITLE): MindmapData {
  const headings = parseHeadings(markdown);
  const topLevel = headings.filter((heading) => heading.level === TOP_LEVEL);
  const rootHeading = topLevel.length === 1 ? topLevel[0] : null;
  const nodes: MindmapNode[] = [{ id: HEADING_MAP_ROOT_ID, parentId: null, text: rootHeading?.text ?? noteTitle }];
  const open: OpenHeading[] = [];
  headings.forEach((heading, index) => {
    while ((open.at(-1)?.level ?? 0) >= heading.level) open.pop();
    if (heading === rootHeading) {
      open.push({ level: heading.level, id: HEADING_MAP_ROOT_ID });
      return;
    }
    const id = `heading-${index}`;
    nodes.push({ id, parentId: open.at(-1)?.id ?? HEADING_MAP_ROOT_ID, text: heading.text });
    open.push({ level: heading.level, id });
  });
  return nodes;
}
