import {
  findEditProblem,
  type EditRequest,
  type MindmapData,
  type NodeId,
  type NodeOffset,
  type NodeOffsets,
} from 'organic-mindmap';
import { claimUniqueBlockId, type BlockIdSource } from './blockId';
import { findLayoutBlock, formatLayoutJsonLines, newLayoutBlockLines } from './layoutBlock';
import { appendBlockId, formatListItemLine, isBulletMarker, toSingleLine, type ListItemLine } from './listItemLine';
import { displayLabel } from './linkLabel';
import { firstLinkTarget } from './linkTarget';
import { indentWidth, isBlank, NoteLines, reindent } from './noteLines';

/** One map node as read from the note. */
export interface NoteNode {
  /** The item's block id (generated on read when the item has none yet). */
  readonly id: NodeId;
  readonly parentId: NodeId | null;
  /** Shown on the map: each `[[link]]` as its display text. */
  readonly label: string;
  /** The item text as written, without the block id; e.g. to open the linked note on click. */
  readonly rawText: string;
}

/** A list item found by the reader. */
export interface NoteItem {
  readonly id: NodeId;
  readonly parentId: NodeId | null;
  /** 0-based index of the item's line in the note. */
  readonly lineIndex: number;
  readonly line: ListItemLine;
  /** False when `id` was generated on read and is not written in the note yet. */
  readonly idInFile: boolean;
}

/** What the reader hands over; create notes with `readMindmapNote`. */
export interface MindmapNoteParts {
  readonly text: string;
  /** Index of the first line after the frontmatter. */
  readonly bodyStart: number;
  /** In note order; the first one is the root. */
  readonly items: readonly NoteItem[];
  readonly positions: NodeOffsets;
  readonly newBlockId: BlockIdSource;
}

export type NoteWriteResult =
  | { readonly kind: 'written'; readonly text: string }
  /** Nothing to write; `reason` is plain language. */
  | { readonly kind: 'refused'; readonly reason: string };

/** Indentation for new or moved items when no item is nested yet. */
const DEFAULT_INDENT_UNIT = '\t';
const DEFAULT_BULLET = '-';

/**
 * A mindmap note as read from its text, and every write the map makes to it. Each write returns the new note text
 * and changes only the lines it touches; every other byte stays as it was. Every write also adds the block ids
 * that were generated on read, so later reads key on the same ids.
 * Generated ids only resolve within this read, so edits always go through the note they were drawn from.
 */
export class MindmapNote {
  readonly text: string;
  readonly nodes: readonly NoteNode[];
  /** Saved offsets from the parent, only for ids in the list. */
  readonly positions: NodeOffsets;
  private readonly bodyStart: number;
  private readonly items: ReadonlyMap<NodeId, NoteItem>;
  private readonly root: NoteItem;
  private readonly lastItem: NoteItem;
  private readonly newBlockId: BlockIdSource;
  private readonly indentUnit: string;
  private readonly bullet: string;
  private readonly data: MindmapData;

  constructor(parts: MindmapNoteParts) {
    const [root] = parts.items;
    const lastItem = parts.items[parts.items.length - 1];
    if (root === undefined || lastItem === undefined) throw new Error('A mindmap note needs at least one item');
    this.text = parts.text;
    this.bodyStart = parts.bodyStart;
    this.positions = parts.positions;
    this.newBlockId = parts.newBlockId;
    this.root = root;
    this.lastItem = lastItem;
    this.items = new Map(parts.items.map((item) => [item.id, item]));
    this.nodes = parts.items.map((item) => ({
      id: item.id,
      parentId: item.parentId,
      label: displayLabel(item.line.text),
      rawText: item.line.text,
    }));
    this.data = this.nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      text: node.label,
      // Same rule as the click (`firstLinkTarget`), so a node looks like a link exactly when a click opens one.
      ...(firstLinkTarget(node.rawText) === null ? {} : { link: true }),
    }));
    this.indentUnit = detectIndentUnit(parts.items, this.items);
    this.bullet = isBulletMarker(root.line.marker) ? root.line.marker : DEFAULT_BULLET;
  }

  /** The library's data: one node per item, labels as shown, items with a `[[link]]` marked as links. */
  toMindmapData(): MindmapData {
    return this.data;
  }

  /**
   * The note text after `request`. `add` and `move` place the item as the last child of its parent; `side` is
   * ignored (the auto layout picks it). `move` and `delete` also drop the branch's saved offsets from the layout
   * block: a deleted branch has nothing to place, and a moved one's offsets were measured from the old parent (the
   * library drops them from the map too, see `MountOptions.onNodeOffsetsChange`). Doing it in the same write keeps
   * the note consistent on its own and lets Undo restore the offsets with the branch.
   * Refuses what the library refuses (unknown node, dropping into the own branch, deleting the root) with the
   * library's wording.
   */
  applyEdit(request: EditRequest): NoteWriteResult {
    const problem = findEditProblem(this.data, request);
    if (problem !== null) return { kind: 'refused', reason: problem };
    const lines = this.linesWithAllBlockIds();
    switch (request.type) {
      case 'rename':
        this.rename(lines, request.nodeId, request.text);
        break;
      case 'add':
        this.add(lines, request.parentId, request.text);
        break;
      case 'move':
        this.move(lines, request.nodeId, request.newParentId);
        this.dropBranchPositions(lines, request.nodeId);
        break;
      case 'delete':
        this.delete(lines, request.nodeId);
        this.dropBranchPositions(lines, request.nodeId);
        break;
    }
    return { kind: 'written', text: lines.toText() };
  }

  /**
   * The note text with `offsets` as the whole saved layout (e.g. what the map reports after a drop): rewrites the
   * layout block deterministically, dropping ids that are not in the list, and creates the block (inside `%%`)
   * after the list when missing. With nothing to save and no block yet, no block is added.
   */
  setPositions(offsets: NodeOffsets): string {
    const known = new Map(Object.entries(offsets).filter(([id]) => this.items.has(id)));
    const lines = this.linesWithAllBlockIds();
    this.writeLayout(lines, known);
    return lines.toText();
  }

  /** Rewrites the layout block with `offsets`, creating it when missing and there is something to save. */
  private writeLayout(lines: NoteLines, offsets: ReadonlyMap<NodeId, NodeOffset>): void {
    const layout = findLayoutBlock(lines.contents(), this.bodyStart);
    if (layout === null) {
      if (offsets.size > 0) this.insertLayoutBlock(lines, formatLayoutJsonLines(offsets));
    } else {
      lines.remove(layout.openLine + 1, layout.closeLine - 1);
      lines.insertAfter(layout.openLine, formatLayoutJsonLines(offsets));
    }
  }

  /**
   * Removes the saved offsets of `nodeId` and its descendants; leaves the layout block untouched when none is saved.
   * Runs after the list edit: the block is found again in the edited lines, so shifted line numbers do not matter.
   */
  private dropBranchPositions(lines: NoteLines, nodeId: NodeId): void {
    const branch = this.branchIds(nodeId);
    const saved = Object.entries(this.positions);
    if (!saved.some(([id]) => branch.has(id))) return;
    this.writeLayout(lines, new Map(saved.filter(([id]) => !branch.has(id))));
  }

  /** `nodeId` and every item below it. Note order lists each parent before its children, so one pass suffices. */
  private branchIds(nodeId: NodeId): Set<NodeId> {
    const branch = new Set<NodeId>([nodeId]);
    for (const node of this.nodes) {
      if (node.parentId !== null && branch.has(node.parentId)) branch.add(node.id);
    }
    return branch;
  }

  private rename(lines: NoteLines, nodeId: NodeId, text: string): void {
    const item = this.item(nodeId);
    lines.setContent(item.lineIndex, formatListItemLine(item.line.prefix, toSingleLine(text), nodeId));
  }

  private add(lines: NoteLines, parentId: NodeId, text: string): void {
    const parent = this.item(parentId);
    const id = claimUniqueBlockId(this.newBlockId, new Set(this.items.keys()));
    const prefix = `${this.childIndent(parent)}${this.bullet} `;
    lines.insertAfter(lines.subtreeEnd(parent.lineIndex), [formatListItemLine(prefix, toSingleLine(text), id)]);
  }

  private move(lines: NoteLines, nodeId: NodeId, newParentId: NodeId): void {
    const item = this.item(nodeId);
    const parent = this.item(newParentId);
    const end = lines.subtreeEnd(item.lineIndex);
    const moved = lines.remove(item.lineIndex, end);
    // The new parent is not in the moved branch (refused up front), so it is either before or after it.
    const parentLine = parent.lineIndex > end ? parent.lineIndex - moved.length : parent.lineIndex;
    const oldWidth = indentWidth(item.line.indent);
    const newIndent = this.childIndent(parent);
    lines.insertAfter(
      lines.subtreeEnd(parentLine),
      moved.map((line) => reindent(line, oldWidth, newIndent)),
    );
  }

  private delete(lines: NoteLines, nodeId: NodeId): void {
    const start = this.item(nodeId).lineIndex;
    lines.remove(start, lines.subtreeEnd(start));
  }

  private insertLayoutBlock(lines: NoteLines, jsonLines: readonly string[]): void {
    // The root's branch can end before the last item when text at the root's depth sits between items.
    const listEnd = Math.max(lines.subtreeEnd(this.root.lineIndex), lines.subtreeEnd(this.lastItem.lineIndex));
    const next = listEnd + 1 < lines.length ? lines.content(listEnd + 1) : null;
    const spacerAfter = next !== null && !isBlank(next) ? [''] : [];
    lines.insertAfter(listEnd, ['', ...newLayoutBlockLines(jsonLines), ...spacerAfter]);
  }

  /** The note's lines with every generated id appended to its item line (the line count does not change). */
  private linesWithAllBlockIds(): NoteLines {
    const lines = NoteLines.fromText(this.text);
    for (const item of this.items.values()) {
      if (!item.idInFile) lines.setContent(item.lineIndex, appendBlockId(lines.content(item.lineIndex), item.id));
    }
    return lines;
  }

  private childIndent(parent: NoteItem): string {
    return parent.line.indent + this.indentUnit;
  }

  private item(nodeId: NodeId): NoteItem {
    const item = this.items.get(nodeId);
    // Unknown ids are refused before any write, so this is a bug, not a user error.
    if (item === undefined) throw new Error(`No item with nodeId=[${nodeId}]`);
    return item;
  }
}

/**
 * The note's own nesting step: what the first nested item adds to its parent's indentation (e.g. a tab, or two or
 * four spaces). Tab when nothing is nested yet, or when the first nesting is not a plain extension of the parent's.
 */
function detectIndentUnit(items: readonly NoteItem[], byId: ReadonlyMap<NodeId, NoteItem>): string {
  for (const item of items) {
    const parent = item.parentId === null ? undefined : byId.get(item.parentId);
    if (parent === undefined) continue;
    const parentIndent = parent.line.indent;
    const childIndent = item.line.indent;
    return childIndent.startsWith(parentIndent) && childIndent.length > parentIndent.length
      ? childIndent.slice(parentIndent.length)
      : DEFAULT_INDENT_UNIT;
  }
  return DEFAULT_INDENT_UNIT;
}
