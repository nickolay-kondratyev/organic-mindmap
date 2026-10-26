import { applyEdit } from '../edit/applyEdit';
import type { AddEditRequest, EditRequest } from '../edit/editRequest';
import { EDIT_BLOCKED_REASON, type EditSession, type EditStatus } from '../edit/editSession';
import { findEditProblem } from '../edit/editValidation';
import type { NodePositions } from '../layout/layoutTypes';
import {
  offsetBetween,
  subtreeMoveBy,
  withNodeDropped,
  withoutSubtree,
  type PositionOverrides,
} from '../layout/positionOverrides';
import { rememberLast } from '../memo/rememberLast';
import type { MindmapData, NodeId, Point, Side } from '../model/node';
import { buildTree, type MindmapTree } from '../model/tree';
import type { NodeRepositionEvent } from './repositionEvent';

/** Id of the local, not-yet-sent child shown while its label is typed (the host picks the real id). */
export const DRAFT_NODE_ID: NodeId = 'organic-mindmap:draft-node';

/** The part of a painted scene a drop is measured against. */
export interface DropScene {
  readonly tree: MindmapTree;
  readonly positions: NodePositions;
  /** What the drop's offset from the parent is measured from (see `Scene.placedPositions`). */
  readonly placedPositions: NodePositions;
}

/**
 * The add request a "+" opens as a draft child of `parentId`, or `null` when that node is not in `data`.
 * `side` only matters for children of the root (spec R19), so it is kept only there.
 */
export function addDraftRequest(data: MindmapData, parentId: NodeId, side: Side | undefined): AddEditRequest | null {
  const parent = data.find((candidate) => candidate.id === parentId);
  if (parent === undefined) return null;
  const plain: AddEditRequest = { type: 'add', parentId, text: '' };
  return parent.parentId === null && side !== undefined ? { ...plain, side } : plain;
}

/**
 * What the canvas interactions keep on top of `EditSession` (DOM-free): library-local position overrides
 * (spec I2), the draft child being typed (I4) and the last request sent from the inline editor, so a rejection
 * of it can be reopened for retry (I5.4). Decides what to show and how status changes affect that state.
 */
export class LocalEditState {
  private overrides: PositionOverrides = new Map();
  private draft: AddEditRequest | null = null;
  private editorRequest: EditRequest | null = null;
  private previousStatus: EditStatus;

  /** `onOverridesChange` hears every change the user causes (drops, a confirmed reparent), not `setOverrides`. */
  constructor(
    private readonly edits: EditSession,
    private readonly onOverridesChange: (overrides: PositionOverrides) => void,
  ) {
    this.previousStatus = edits.status;
  }

  /** Replaces the overrides, e.g. with positions the host saved earlier. */
  setOverrides(overrides: PositionOverrides): void {
    this.overrides = overrides;
  }

  /**
   * Pending preview, else the draft child (if its parent still exists), else the confirmed data.
   * Derived values are remembered by input identity so unchanged state repaints with the same object (scene cache).
   */
  displayData(): MindmapData {
    const { edits, draft } = this;
    if (draft === null || edits.status.kind === 'pending' || findEditProblem(edits.confirmedData, draft) !== null) {
      return edits.displayData;
    }
    return this.withDraft(edits.confirmedData, draft);
  }

  private readonly withDraft = rememberLast((data: MindmapData, draft: AddEditRequest) => applyEdit(data, draft, DRAFT_NODE_ID));

  /** While a reparent is pending, the moved subtree previews at its new parent's layout spot (see `onEditStatusChange`). */
  effectiveOverrides(): PositionOverrides {
    const { status, confirmedData } = this.edits;
    if (status.kind !== 'pending' || status.request.type !== 'move') return this.overrides;
    return this.withoutPendingMove(this.overrides, confirmedData, status.request.nodeId);
  }

  private readonly withoutPendingMove = rememberLast((overrides: PositionOverrides, data: MindmapData, movedId: NodeId) =>
    withoutSubtree(overrides, buildTree(data), movedId),
  );

  /** Why an editor must not open now, or `null`: not while an edit is pending (spec I5.2), so no typing is lost. */
  editorBlockedReason(): string | null {
    return this.edits.status.kind === 'pending' ? EDIT_BLOCKED_REASON : null;
  }

  showDraft(draft: AddEditRequest): void {
    this.draft = draft;
  }

  clearDraft(): void {
    this.draft = null;
  }

  /** Remembers `request` as sent from the inline editor, so its rejection reopens the editor. */
  sentFromEditor(request: EditRequest): void {
    this.editorRequest = request;
  }

  /**
   * A node dragged by scene-unit `offset` and dropped away from any node (spec I2): stores the override and
   * returns the event to report, or `null` when `nodeId` is not in `scene` or is the root (which never moves).
   */
  dropAway(scene: DropScene, nodeId: NodeId, offset: Point): NodeRepositionEvent | null {
    const drop = subtreeMoveBy(scene.positions, scene.tree, nodeId, offset);
    if (drop === null) return null;
    const parent = scene.tree.parentOf(nodeId);
    const parentAt = parent === null ? undefined : scene.placedPositions.get(parent.id);
    if (parentAt === undefined) return null;
    this.changeOverrides(withNodeDropped(this.overrides, scene.tree, drop, offsetBetween(parentAt, drop.to)));
    return { nodeId, position: drop.to };
  }

  /** Updates the state for the new edit status; returns the editor request to reopen for retry, if any. */
  onEditStatusChange(status: EditStatus): EditRequest | null {
    const previous = this.previousStatus;
    this.previousStatus = status;
    // A confirmed reparent lands at its new parent's layout spot, not at a position dragged under the old parent.
    if (previous.kind === 'pending' && previous.request.type === 'move' && status.kind === 'idle') {
      const kept = withoutSubtree(this.overrides, buildTree(this.edits.confirmedData), previous.request.nodeId);
      if (kept.size !== this.overrides.size) this.changeOverrides(kept);
    }
    if (status.kind === 'idle') this.editorRequest = null;
    return status.kind === 'rejected' && status.request === this.editorRequest ? status.request : null;
  }

  private changeOverrides(overrides: PositionOverrides): void {
    this.overrides = overrides;
    this.onOverridesChange(overrides);
  }
}
