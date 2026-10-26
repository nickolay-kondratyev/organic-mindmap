import type { NodeId } from 'organic-mindmap';
import { claimUniqueBlockId, randomBlockId, type BlockIdSource } from './blockId';
import { findFrontmatter } from './frontmatter';
import { findLayoutBlock, parseLayoutJson, type NodeOffset } from './layoutBlock';
import { parseListItemLine, type ListItemLine } from './listItemLine';
import { MindmapNote, type NoteItem } from './mindmapNote';
import { indentWidth, NoteLines } from './noteLines';

export type NoteReadResult =
  | { readonly kind: 'read'; readonly note: MindmapNote }
  /** The note cannot be shown as a map; `problem` says why and how to fix it, in plain language. */
  | { readonly kind: 'problem'; readonly problem: string };

/** Plain-language reasons a note cannot be read as a map. Line numbers are 1-based, as the editor shows them. */
export const NOTE_PROBLEM = {
  noListItem: 'A mindmap note needs exactly one top-level list item, and this note has none. Add one like "- Central topic".',
  severalTopLevelItems: (count: number) =>
    `A mindmap note needs exactly one top-level list item, and this note has ${count}. Indent the others under the first one.`,
  duplicateBlockId: (blockId: string, firstLine: number, secondLine: number) =>
    `Lines ${firstLine} and ${secondLine} both end with the block id ^${blockId}. Change one of them so each item has its own id.`,
} as const;

/** Toggles an Obsidian comment when it appears an odd number of times on a line. */
const COMMENT_DELIMITER = '%%';
/** [regex]: 1 the fence characters (3+ backticks or tildes) opening a fenced code block. */
const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})/;

/**
 * Reads a mindmap note: the list items (outside frontmatter, code blocks and `%%` comments) form the tree, nesting
 * by indentation. Items without a block id get one from `newBlockId`; it reaches the file only with the next write
 * from the map, so opening a note never changes it.
 */
export function readMindmapNote(text: string, newBlockId: BlockIdSource = randomBlockId): NoteReadResult {
  const lines = NoteLines.fromText(text).contents();
  const bodyStart = findFrontmatter(lines)?.bodyStart ?? 0;
  const found = scanListItems(lines, bodyStart);

  const topLevelCount = found.filter((item) => item.parentIndex === null).length;
  if (topLevelCount === 0) return { kind: 'problem', problem: NOTE_PROBLEM.noListItem };
  if (topLevelCount > 1) return { kind: 'problem', problem: NOTE_PROBLEM.severalTopLevelItems(topLevelCount) };
  const duplicate = findDuplicateBlockId(found);
  if (duplicate !== null) return { kind: 'problem', problem: duplicate };

  const items = assignIds(found, newBlockId);
  const layout = findLayoutBlock(lines, bodyStart);
  const savedOffsets = layout === null ? new Map<NodeId, NodeOffset>() : parseLayoutJson(lines.slice(layout.openLine + 1, layout.closeLine).join('\n'));
  const knownIds = new Set(items.map((item) => item.id));
  const positions = Object.fromEntries([...savedOffsets].filter(([id]) => knownIds.has(id)));
  return { kind: 'read', note: new MindmapNote({ text, bodyStart, items, positions, newBlockId }) };
}

interface FoundItem {
  readonly lineIndex: number;
  readonly line: ListItemLine;
  /** Index into the found items, `null` for a top-level item. */
  readonly parentIndex: number | null;
}

function scanListItems(lines: readonly string[], bodyStart: number): FoundItem[] {
  const found: FoundItem[] = [];
  /** Indexes into `found` of the open ancestors, shallowest first. */
  const ancestors: number[] = [];
  let openFence: string | null = null;
  let inComment = false;
  for (let lineIndex = bodyStart; lineIndex < lines.length; lineIndex++) {
    const text = lines[lineIndex] ?? '';
    if (openFence !== null) {
      if (closesFence(text, openFence)) openFence = null;
      continue;
    }
    const togglesComment = text.split(COMMENT_DELIMITER).length % 2 === 0;
    if (inComment) {
      if (togglesComment) inComment = false;
      continue;
    }
    if (togglesComment) inComment = true;
    const fence = FENCE_OPEN.exec(text)?.[1];
    if (fence !== undefined) {
      openFence = fence;
      continue;
    }
    const line = parseListItemLine(text);
    if (line === null) continue;
    const width = indentWidth(line.indent);
    while (ancestors.length > 0 && indentWidth(found[ancestors[ancestors.length - 1]!]!.line.indent) >= width) {
      ancestors.pop();
    }
    found.push({ lineIndex, line, parentIndex: ancestors[ancestors.length - 1] ?? null });
    ancestors.push(found.length - 1);
  }
  return found;
}

/** CommonMark: the closing fence uses the same character, at least as many times, and nothing after it. */
function closesFence(text: string, openFence: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= openFence.length && [...trimmed].every((char) => char === openFence.charAt(0));
}

function findDuplicateBlockId(found: readonly FoundItem[]): string | null {
  const firstLineById = new Map<string, number>();
  for (const item of found) {
    const id = item.line.blockId;
    if (id === null) continue;
    const firstLine = firstLineById.get(id);
    if (firstLine !== undefined) return NOTE_PROBLEM.duplicateBlockId(id, firstLine + 1, item.lineIndex + 1);
    firstLineById.set(id, item.lineIndex);
  }
  return null;
}

function assignIds(found: readonly FoundItem[], newBlockId: BlockIdSource): NoteItem[] {
  const taken = new Set(found.flatMap((item) => (item.line.blockId === null ? [] : [item.line.blockId])));
  const ids = found.map((item) => item.line.blockId ?? claimUniqueBlockId(newBlockId, taken));
  return found.map((item, index) => ({
    id: ids[index]!,
    parentId: item.parentIndex === null ? null : ids[item.parentIndex]!,
    lineIndex: item.lineIndex,
    line: item.line,
    idInFile: item.line.blockId !== null,
  }));
}
