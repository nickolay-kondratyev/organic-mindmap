import type { NodeId, Point, Side } from '../model/node';
import type { LayoutContext, LayoutStage, NodePositions } from './layoutTypes';
import { outwardDirection, requirePosition, subtreeIds } from './layoutLookups';

/**
 * Stage 2 (spec R21): fans first-level branches out in an outward bow. Per side, a first-level node's
 * vertical distance from the root is normalized against the farthest one on that side and fed to the
 * pluggable `context.bowCurve`; the result scales `config.bowOffset`. The whole subtree shifts with its
 * first-level node, so the tidy shape inside each limb is kept.
 */
export const rootBowStage: LayoutStage = {
  name: 'root-bow',
  run(positions: NodePositions, context: LayoutContext): NodePositions {
    const { tree, config, bowCurve } = context;
    const result = new Map<NodeId, Point>(positions);
    const firstLevel = tree.childrenOf(tree.root.id);
    const rootY = requirePosition(positions, tree.root.id).y;
    // Keyed by `sideOf` as-is: first-level nodes always have a side, so `null` never occurs in practice.
    const farthestBySide = new Map<Side | null, number>();
    for (const node of firstLevel) {
      const side = tree.sideOf(node.id);
      const distance = Math.abs(requirePosition(positions, node.id).y - rootY);
      farthestBySide.set(side, Math.max(farthestBySide.get(side) ?? 0, distance));
    }
    for (const node of firstLevel) {
      const farthest = farthestBySide.get(tree.sideOf(node.id)) ?? 0;
      const distance = Math.abs(requirePosition(positions, node.id).y - rootY);
      // A side whose only nodes are level with the root has nothing to bow (and would divide by zero).
      const normalized = farthest === 0 ? 0 : distance / farthest;
      const shiftX = outwardDirection(tree, node.id) * bowCurve(normalized) * config.bowOffset;
      for (const id of subtreeIds(tree, node.id)) {
        const current = requirePosition(positions, id);
        result.set(id, { x: current.x + shiftX, y: current.y });
      }
    }
    return result;
  },
};
