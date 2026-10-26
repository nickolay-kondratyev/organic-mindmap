/**
 * One Markdown list item line: `<indent><marker> [checkbox] <text> ^<block id>`.
 * [regex]: 1 indent, 2 marker (`-`, `*`, `+`, `1.` or `1)`), 3 spacing after the marker, 4 optional task
 * checkbox (`[ ] `, `[x] `), 5 the rest. The marker must be followed by whitespace or end the line, so `---` and
 * `**bold**` are not items.
 */
const LIST_ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])(?:([ \t]+)(\[.\][ \t]+)?(.*))?$/;
/** `* * *`, `- - -`: thematic breaks look like items but are not. */
const THEMATIC_BREAK = /^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/;
/** Obsidian's block id rule: `^` plus letters, digits and `-`, at the end of the line, after whitespace. */
const BLOCK_ID_SUFFIX = /(?:^|[ \t])\^([A-Za-z0-9-]+)[ \t]*$/;
const BULLETS = new Set(['-', '*', '+']);

export interface ListItemLine {
  /** Leading whitespace. */
  readonly indent: string;
  /** `-`, `*`, `+`, `1.` or `1)`. */
  readonly marker: string;
  /** Everything before the item text (indent, marker, spacing, checkbox); kept as-is on rename. */
  readonly prefix: string;
  /** The item text without the block id, as written (links unresolved). */
  readonly text: string;
  readonly blockId: string | null;
}

export function parseListItemLine(line: string): ListItemLine | null {
  if (THEMATIC_BREAK.test(line)) return null;
  const match = LIST_ITEM.exec(line);
  if (match === null) return null;
  const [, indent = '', marker = '', spacing, checkbox = '', rest = ''] = match;
  // A bare marker (`-`) gets one space so text written after it still forms an item.
  const prefix = indent + marker + (spacing ?? ' ') + checkbox;
  const idMatch = BLOCK_ID_SUFFIX.exec(rest);
  if (idMatch === null) return { indent, marker, prefix, text: rest.trimEnd(), blockId: null };
  return { indent, marker, prefix, text: rest.slice(0, idMatch.index).trimEnd(), blockId: idMatch[1] ?? null };
}

export function isBulletMarker(marker: string): boolean {
  return BULLETS.has(marker);
}

export function formatListItemLine(prefix: string, text: string, blockId: string): string {
  return text === '' ? `${prefix}^${blockId}` : `${prefix}${text} ^${blockId}`;
}

/** Appends a block id to an item line that has none; the rest of the line stays as written. */
export function appendBlockId(line: string, blockId: string): string {
  return `${line.trimEnd()} ^${blockId}`;
}

/** Typed text as one item line: line breaks would split the item, so runs containing them become one space. */
export function toSingleLine(text: string): string {
  return text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
}
