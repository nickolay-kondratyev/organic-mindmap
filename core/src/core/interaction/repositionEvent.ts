import type { NodeId, Point } from '../model/node';

/**
 * Reported when the user drags a node to a new place (spec I2). Positions are layout, not structure, so
 * this is a plain event with no confirmation. To save and restore positions use `onNodeOffsetsChange` /
 * `nodeOffsets` instead (offsets from the parent, so they still fit after the parent moves).
 */
export interface NodeRepositionEvent {
  readonly nodeId: NodeId;
  /** New centre of the dragged node in scene coordinates (root at origin); its subtree moved along. */
  readonly position: Point;
}
