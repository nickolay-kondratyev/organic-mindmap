import type { NodeId, Point } from '../model/node';
import type { NodeHandle } from './hitTest';

/**
 * Screen px the pointer must travel before a press becomes a drag or pan (spec I2), so the small jitter of a
 * click or double-click never moves anything.
 */
export const DRAG_THRESHOLD_PX = 4;

export function exceedsDragThreshold(start: Point, current: Point): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > DRAG_THRESHOLD_PX;
}

/** What a press started on, as far as gestures care. */
export type PressTarget =
  /** Empty canvas or anything that cannot be moved (e.g. the root): dragging pans the view (spec I1). */
  | { readonly kind: 'canvas' }
  /** A movable node: dragging moves it with its subtree (spec I2/I3). */
  | { readonly kind: 'node'; readonly nodeId: NodeId }
  /** A node that cannot move (the root, spec R23): dragging pans like empty canvas, but releasing in place clicks it. */
  | { readonly kind: 'fixed-node'; readonly nodeId: NodeId }
  /** A hover button: it can only be clicked. */
  | { readonly kind: 'handle'; readonly handle: NodeHandle };

export type GestureStep =
  | { readonly kind: 'none' }
  /** Screen delta since the previous step. */
  | { readonly kind: 'pan'; readonly delta: Point }
  /** Screen offset of the pointer from where the drag was pressed. */
  | { readonly kind: 'drag'; readonly nodeId: NodeId; readonly offset: Point };

export type GestureEnd =
  | { readonly kind: 'none' }
  | { readonly kind: 'click'; readonly target: PressTarget }
  | { readonly kind: 'drag-end'; readonly nodeId: NodeId; readonly offset: Point };

type GestureState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pressed'; readonly target: PressTarget; readonly start: Point }
  | { readonly kind: 'panning'; readonly last: Point }
  | { readonly kind: 'dragging'; readonly nodeId: NodeId; readonly start: Point }
  /** A button press that wandered off past the threshold: it neither clicks nor drags. */
  | { readonly kind: 'abandoned' };

const IDLE: GestureState = { kind: 'idle' };
const NO_STEP: GestureStep = { kind: 'none' };
const NO_END: GestureEnd = { kind: 'none' };

/**
 * Turns one pointer's press -> moves -> release into a click, a pan or a node drag (DOM-free, screen px).
 * Below `DRAG_THRESHOLD_PX` a press stays a click candidate; past it, it commits to a pan or drag for good.
 */
export class PointerGesture {
  private state: GestureState = IDLE;

  press(point: Point, target: PressTarget): void {
    this.state = { kind: 'pressed', target, start: point };
  }

  move(point: Point): GestureStep {
    const state = this.state;
    switch (state.kind) {
      case 'idle':
      case 'abandoned':
        return NO_STEP;
      case 'pressed':
        return this.leaveThreshold(state.target, state.start, point);
      case 'panning':
        this.state = { kind: 'panning', last: point };
        return { kind: 'pan', delta: { x: point.x - state.last.x, y: point.y - state.last.y } };
      case 'dragging':
        return { kind: 'drag', nodeId: state.nodeId, offset: offsetOf(state.start, point) };
    }
  }

  release(point: Point): GestureEnd {
    const state = this.state;
    this.state = IDLE;
    switch (state.kind) {
      case 'idle':
      case 'abandoned':
      case 'panning':
        return NO_END;
      case 'pressed':
        // Past the threshold without any move event in between: not a click, and no drag was ever shown.
        return exceedsDragThreshold(state.start, point) ? NO_END : { kind: 'click', target: state.target };
      case 'dragging':
        return { kind: 'drag-end', nodeId: state.nodeId, offset: offsetOf(state.start, point) };
    }
  }

  /** E.g. pointer capture lost: forget the gesture without clicking or dropping. */
  cancel(): void {
    this.state = IDLE;
  }

  private leaveThreshold(target: PressTarget, start: Point, point: Point): GestureStep {
    if (!exceedsDragThreshold(start, point)) return NO_STEP;
    switch (target.kind) {
      case 'handle':
        this.state = { kind: 'abandoned' };
        return NO_STEP;
      case 'canvas':
      case 'fixed-node':
        this.state = { kind: 'panning', last: point };
        // Include the distance travelled inside the threshold so the view does not lag behind the pointer.
        return { kind: 'pan', delta: offsetOf(start, point) };
      case 'node':
        this.state = { kind: 'dragging', nodeId: target.nodeId, start };
        return { kind: 'drag', nodeId: target.nodeId, offset: offsetOf(start, point) };
    }
  }
}

/**
 * Node a click reports to the host (`onNodeClick`), if any. Hover buttons and bare canvas (including a node's hover
 * area around its "+") are not node clicks. Every click is reported at once, so a double-click is two clicks (plus
 * a rename when renaming is on); see docs/architecture.md "Pointer interactions".
 */
export function clickedNodeId(target: PressTarget): NodeId | null {
  switch (target.kind) {
    case 'node':
    case 'fixed-node':
      return target.nodeId;
    case 'handle':
    case 'canvas':
      return null;
  }
}

function offsetOf(start: Point, point: Point): Point {
  return { x: point.x - start.x, y: point.y - start.y };
}
