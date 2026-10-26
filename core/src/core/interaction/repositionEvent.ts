import type { NodeId, Point } from '../model/node';

/**
 * Reported when the user drags a node to a new place (spec I2). Positions are layout, not structure, so
 * this is a plain event with no confirmation; persisting it is the host's choice.
 */
export interface NodeRepositionEvent {
  readonly nodeId: NodeId;
  /** New centre of the dragged node in scene coordinates (root at origin); its subtree moved along. */
  readonly position: Point;
}
