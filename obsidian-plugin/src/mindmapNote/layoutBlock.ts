import type { NodeId } from 'organic-mindmap';

/**
 * Offset of a node from its parent, as saved in the note.
 * Mirrors the library's saved-positions types (`NodeOffset`, `NodeOffsets`), which are not merged yet; switch to
 * the library's once they land.
 */
export interface NodeOffset {
  readonly dx: number;
  readonly dy: number;
}
export type NodeOffsets = Readonly<Record<NodeId, NodeOffset>>;

/** Language of the fenced code block that holds the saved offsets. */
export const LAYOUT_BLOCK_LANGUAGE = 'organic-mindmap-layout';
/** Obsidian comment delimiter: reading view hides the layout block. */
const COMMENT_DELIMITER = '%%';
const FENCE = '```';
const JSON_ENTRY_INDENT = '  ';
/** [regex]: 1 the opening backtick fence, then the layout language and nothing else. */
const LAYOUT_FENCE_OPEN = new RegExp(`^[ \\t]*(\`{3,})[ \\t]*${LAYOUT_BLOCK_LANGUAGE}[ \\t]*$`);

/** Where the layout block sits: its JSON is on the lines strictly between the two fence lines. */
export interface LayoutBlockLocation {
  readonly openLine: number;
  readonly closeLine: number;
}

/** The first closed `organic-mindmap-layout` fenced block at or after `fromLine`, or `null`. */
export function findLayoutBlock(lines: readonly string[], fromLine: number): LayoutBlockLocation | null {
  for (let open = fromLine; open < lines.length; open++) {
    const fence = LAYOUT_FENCE_OPEN.exec(lines[open] ?? '')?.[1];
    if (fence === undefined) continue;
    const closePattern = new RegExp(`^[ \\t]*\`{${fence.length},}[ \\t]*$`);
    const close = lines.findIndex((line, index) => index > open && closePattern.test(line));
    return close === -1 ? null : { openLine: open, closeLine: close };
  }
  return null;
}

/**
 * Saved offsets from the block's JSON. Malformed JSON reads as no saved offsets, and entries without finite
 * `dx`/`dy` numbers are skipped: a broken layout must never stop the map from opening (nodes fall back to the
 * auto layout).
 */
export function parseLayoutJson(json: string): Map<NodeId, NodeOffset> {
  const offsets = new Map<NodeId, NodeOffset>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return offsets;
  }
  if (!isRecord(parsed)) return offsets;
  for (const [id, value] of Object.entries(parsed)) {
    if (isRecord(value) && isFiniteNumber(value['dx']) && isFiniteNumber(value['dy'])) {
      offsets.set(id, { dx: value['dx'], dy: value['dy'] });
    }
  }
  return offsets;
}

/**
 * The JSON lines for `offsets`, deterministic for clean diffs: ids sorted, one per line, offsets rounded to whole
 * pixels (sub-pixel drag noise would change the file without a visible difference).
 */
export function formatLayoutJsonLines(offsets: ReadonlyMap<NodeId, NodeOffset>): string[] {
  if (offsets.size === 0) return ['{}'];
  // WHY-NOT localeCompare: the order must not depend on the user's locale.
  const ids = [...offsets.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const entries = ids.map((id, index) => {
    const offset = offsets.get(id)!;
    const separator = index < ids.length - 1 ? ',' : '';
    return `${JSON_ENTRY_INDENT}${JSON.stringify(id)}: {"dx": ${wholePixels(offset.dx)}, "dy": ${wholePixels(offset.dy)}}${separator}`;
  });
  return ['{', ...entries, '}'];
}

/** A complete new layout block, wrapped in `%%` so reading view hides it. */
export function newLayoutBlockLines(jsonLines: readonly string[]): string[] {
  return [COMMENT_DELIMITER, `${FENCE}${LAYOUT_BLOCK_LANGUAGE}`, ...jsonLines, FENCE, COMMENT_DELIMITER];
}

function wholePixels(value: number): number {
  // No -0 guard needed: number-to-string conversion writes -0 as "0".
  return Math.round(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
