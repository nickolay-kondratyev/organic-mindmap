import { hierarchy, tree as d3Tree, type HierarchyPointNode } from 'd3-hierarchy';
import type { MindmapNode, NodeId, Point, Side } from '../model/node';
import type { LayoutContext, LayoutStage, NodePositions } from './layoutTypes';
import { outwardDirection, requirePosition, requireSize } from './layoutLookups';

const SIDES: readonly Side[] = ['left', 'right'];

/**
 * d3 measures separation in multiples of `nodeSize[0]`; a unit size makes the separation callback return px,
 * which lets it use each node's own height. The depth axis is unused: x comes from node widths below.
 */
const UNIT_NODE_SIZE: [number, number] = [1, 1];

/**
 * Stage 1 (spec R19/R20): Reingold-Tilford tidy tree per side with d3-hierarchy. Vertical spacing is
 * size-aware (no overlapping subtrees) and the root sits centered between its first and last child on each
 * side. Horizontal placement is edge-to-edge (`horizontalGap` between parent and child boxes) so wider
 * nodes push their children outward. Ignores incoming positions: this stage creates them.
 */
export const tidyTreeStage: LayoutStage = {
  name: 'tidy-tree',
  run(_positions: NodePositions, context: LayoutContext): NodePositions {
    const positions = new Map<NodeId, Point>([[context.tree.root.id, { x: 0, y: 0 }]]);
    for (const side of SIDES) layoutSide(side, context, positions);
    return positions;
  },
};

/**
 * A side's first-level nodes top to bottom. Data order, except that `clockwise` reads the left side bottom to top
 * (right side down, then left side up, like a clock), so the left side is reversed.
 */
function firstLevelInVerticalOrder(side: Side, { tree, config }: LayoutContext): MindmapNode[] {
  const onSide = tree.childrenOf(tree.root.id).filter((n) => tree.sideOf(n.id) === side);
  return config.sideOrder === 'clockwise' && side === 'left' ? onSide.reverse() : onSide;
}

function layoutSide(side: Side, context: LayoutContext, positions: Map<NodeId, Point>): void {
  const { tree, sizes, config } = context;
  const firstLevel = firstLevelInVerticalOrder(side, context);
  if (firstLevel.length === 0) return;

  const sideRoot = hierarchy<MindmapNode>(tree.root, (node) => (node.id === tree.root.id ? firstLevel : tree.childrenOf(node.id)));
  const verticalSeparation = (a: HierarchyPointNode<MindmapNode>, b: HierarchyPointNode<MindmapNode>): number =>
    (requireSize(sizes, a.data.id).height + requireSize(sizes, b.data.id).height) / 2 + config.verticalGap;
  const laidOut = d3Tree<MindmapNode>().nodeSize(UNIT_NODE_SIZE).separation(verticalSeparation)(sideRoot);

  // d3 lays trees out top-down: its `x` is our vertical axis, and with `nodeSize` the root is at 0.
  // `descendants()` is breadth-first, so a parent is always positioned before its children.
  for (const node of laidOut.descendants()) {
    if (node.parent === null) continue;
    const parentX = requirePosition(positions, node.parent.data.id).x;
    const step =
      requireSize(sizes, node.parent.data.id).width / 2 + config.horizontalGap + requireSize(sizes, node.data.id).width / 2;
    positions.set(node.data.id, { x: parentX + outwardDirection(tree, node.data.id) * step, y: node.x });
  }
}
