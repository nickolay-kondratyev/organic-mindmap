import type { NodeSizeConfig } from '../config/config';
import type { NodeId, NodeSize } from '../model/node';
import type { MindmapTree } from '../model/tree';

export type NodeSizeMap = ReadonlyMap<NodeId, NodeSize>;

/**
 * Single source of node sizes (spec R4): root largest, shrinking per depth, data `size` wins.
 * Layout, collision, branch rims and text fitting all read from this map.
 */
export function resolveNodeSizes(tree: MindmapTree, config: NodeSizeConfig): NodeSizeMap {
  const sizes = new Map<NodeId, NodeSize>();
  for (const node of tree.nodes) {
    sizes.set(node.id, node.size ?? defaultSizeAtDepth(tree.depthOf(node.id), config));
  }
  return sizes;
}

export function defaultSizeAtDepth(depth: number, config: NodeSizeConfig): NodeSize {
  const scale = Math.max(config.minScale, config.depthScale ** depth);
  return { width: config.rootSize.width * scale, height: config.rootSize.height * scale };
}
