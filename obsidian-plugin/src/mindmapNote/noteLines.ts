/** Columns a tab advances to (Obsidian's default tab size). Only used to compare how deep lines are indented. */
export const TAB_WIDTH = 4;
const DEFAULT_EOL = '\n';
/** Captures each line break so the exact bytes (`\n` or `\r\n`) are written back. */
const LINE_BREAK = /(\r\n|\n)/;

export function leadingWhitespace(line: string): string {
  return /^[ \t]*/.exec(line)?.[0] ?? '';
}

/** Visual width of `whitespace`, with tabs advancing to the next multiple of `TAB_WIDTH`. */
export function indentWidth(whitespace: string): number {
  let width = 0;
  for (const char of whitespace) width = advanceColumn(width, char);
  return width;
}

export function isBlank(line: string): boolean {
  return line.trim() === '';
}

/**
 * Moves the lines of a subtree to a new depth: the first `oldIndentWidth` columns of each line are replaced by
 * `newIndent`, so deeper lines keep their extra indentation. Blank lines and lines indented less than the item
 * (lazy continuation) are kept as they are.
 */
export function reindent(line: string, oldIndentWidth: number, newIndent: string): string {
  const lead = leadingWhitespace(line);
  if (isBlank(line) || indentWidth(lead) < oldIndentWidth) return line;
  let consumed = 0;
  let width = 0;
  while (width < oldIndentWidth) width = advanceColumn(width, lead.charAt(consumed++));
  return newIndent + line.slice(consumed);
}

function advanceColumn(width: number, char: string): number {
  return char === '\t' ? width + TAB_WIDTH - (width % TAB_WIDTH) : width + 1;
}

interface NoteLine {
  content: string;
  /** The line break after `content`; `''` only on the last line. */
  eol: string;
}

/**
 * A note's text as editable lines that joins back to the exact original bytes when untouched (line breaks
 * included, and whether the file ends with one). Mutable: make one per edit with `fromText`.
 */
export class NoteLines {
  private constructor(
    private readonly lines: NoteLine[],
    /** Line break used for inserted lines: the note's first one. */
    private readonly eol: string,
  ) {}

  static fromText(text: string): NoteLines {
    // [split with a capture group]: alternates content and line break: [c0, eol0, c1, eol1, ..., cLast].
    const parts = text.split(LINE_BREAK);
    const lines: NoteLine[] = [];
    for (let i = 0; i < parts.length; i += 2) lines.push({ content: parts[i] ?? '', eol: parts[i + 1] ?? '' });
    return new NoteLines(lines, parts[1] ?? DEFAULT_EOL);
  }

  get length(): number {
    return this.lines.length;
  }

  contents(): string[] {
    return this.lines.map((line) => line.content);
  }

  content(index: number): string {
    return this.line(index).content;
  }

  setContent(index: number, content: string): void {
    this.line(index).content = content;
  }

  /**
   * Last line of the item at `index` with everything nested under it: following lines indented deeper than it,
   * blank lines in between included, trailing blank lines not.
   */
  subtreeEnd(index: number): number {
    const width = indentWidth(leadingWhitespace(this.content(index)));
    let end = index;
    for (let i = index + 1; i < this.lines.length; i++) {
      const content = this.content(i);
      if (isBlank(content)) continue;
      if (indentWidth(leadingWhitespace(content)) <= width) break;
      end = i;
    }
    return end;
  }

  insertAfter(index: number, contents: readonly string[]): void {
    if (contents.length === 0) return;
    const anchor = this.line(index);
    const endsFile = anchor.eol === '';
    if (endsFile) anchor.eol = this.eol;
    const inserted = contents.map((content) => ({ content, eol: this.eol }));
    // Keep "the file has no final line break" when inserting after the last line.
    if (endsFile) inserted[inserted.length - 1]!.eol = '';
    this.lines.splice(index + 1, 0, ...inserted);
  }

  /** Removes lines `start..end` (inclusive) and returns their contents. Nothing happens when `start > end`. */
  remove(start: number, end: number): string[] {
    if (start > end) return [];
    const removedLast = this.line(end);
    // Keep "the file has no final line break" when the removed lines ended the file.
    if (removedLast.eol === '' && start > 0) this.line(start - 1).eol = '';
    return this.lines.splice(start, end - start + 1).map((line) => line.content);
  }

  toText(): string {
    return this.lines.map((line) => line.content + line.eol).join('');
  }

  private line(index: number): NoteLine {
    const line = this.lines[index];
    if (line === undefined) throw new Error(`No line at index=[${index}] (note has ${this.lines.length} lines)`);
    return line;
  }
}
