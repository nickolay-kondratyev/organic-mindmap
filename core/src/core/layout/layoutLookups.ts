import type { NodeId, NodeSize, Point } from '../model/node';
import type { MindmapTree } from '../model/tree';
import type { NodeSizeMap } from '../size/nodeSizeResolver';
import type { NodePositions } from './layoutTypes';

/** Stage-order mistakes (e.g. a host putting the bow before the tree stage) fail plainly instead of producing NaN. */
export function requirePosition(positions: NodePositions, id: NodeId): Point {
  const position = positions.get(id);
  if (position === undefined) throw new Error(`Layout stage needs a position for node [${id}]; run a positioning stage first`);
  return position;
}

export function requireSize(sizes: NodeSizeMap, id: NodeId): NodeSize {
  const size = sizes.get(id);
  if (size === undefined) throw new Error(`No node size for node [${id}]; sizes come from resolveNodeSizes`);
  return size;
}

/** `id` followed by all of its descendants, depth-first. */
export function subtreeIds(tree: MindmapTree, id: NodeId): NodeId[] {
  const ids: NodeId[] = [id];
  for (const child of tree.childrenOf(id)) ids.push(...subtreeIds(tree, child.id));
  return ids;
}

/** -1 for the left side, +1 for the right side: the sign of "outward" along x. */
export function outwardDirection(tree: MindmapTree, id: NodeId): number {
  return tree.sideOf(id) === 'left' ? -1 : 1;
}
