import type { NodeId, Point } from '../model/node';
import type { NodeShape } from '../shape/nodeShape';
import { nodeAt, type HitScene } from './hitTest';
import { isTransient } from './localEditState';

/**
 * Reported when the user right-clicks a node, so the host can show its own menu there (e.g. Obsidian's
 * `menu.showAtPosition(event.clientPoint)`) and act through `requestEdit`.
 */
export interface NodeContextMenuEvent {
  readonly nodeId: NodeId;
  /** Viewport (DOM `clientX`/`clientY`) point of the right-click, where a host menu opens. */
  readonly clientPoint: Point;
}

/**
 * The node a right-click at `scenePoint` reports, or `null` to leave the right-click to the browser: bare canvas
 * (including the hover "+" and its hover area) and the not-yet-real preview/draft nodes.
 */
export function contextMenuNodeId(scene: HitScene, scenePoint: Point, shape: NodeShape): NodeId | null {
  const nodeId = nodeAt(scene, scenePoint, shape);
  return nodeId === null || isTransient(nodeId) ? null : nodeId;
}
