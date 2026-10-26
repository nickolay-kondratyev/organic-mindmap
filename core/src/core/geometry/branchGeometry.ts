import type { BranchConfig } from '../config/config';
import type { NodePositions } from '../layout/layoutTypes';
import { GOLDEN_RATIO } from '../math/goldenRatio';
import type { NodeId, NodeSize, Point } from '../model/node';
import type { MindmapTree } from '../model/tree';
import type { NodeSizeMap } from '../size/nodeSizeResolver';
import type { Branch, BranchWidth } from './branchPath';
import { CubicBezierPath, type CubicControlPoints } from './cubicBezierPath';
import { routeBranches, type RoutableBranch } from './branchRouting';

export interface BranchGeometryInput {
  readonly tree: MindmapTree;
  readonly positions: NodePositions;
  readonly sizes: NodeSizeMap;
  readonly config: BranchConfig;
}

/**
 * Fraction of the horizontal distance from the parent's edge to the children at which siblings' curves share
 * their first control point. Measured from the edge, not the center, so the shared trunk is visible outside the
 * node for every node size (spec §8 Forks: a soft "Y" close to the parent); 1/phi^2 ~ 0.38 keeps that trunk
 * short while the curves still settle smoothly into each child.
 */
const FORK_DISTANCE_FRACTION = 1 / GOLDEN_RATIO ** 2;
/** Fraction of the horizontal distance over which a curve flattens out before reaching the child (spec R6). */
const SETTLE_DISTANCE_FRACTION = 1 / GOLDEN_RATIO ** 2;
/**
 * Floor on the fork/settle distance so near-vertical links (child almost above its parent) still leave
 * horizontally instead of degenerating into a straight vertical stub.
 */
const MIN_HORIZONTAL_HANDLE_PX = 24;

/**
 * Builds every parent->child limb (spec R5-R9): a cubic that leaves the parent horizontally through a fork
 * point shared by all siblings (soft Y), settles horizontally into the child, then gets routed around
 * unrelated nodes and separated from overlapping limbs. Pure: same input -> same branches (Q1).
 */
export function buildBranches(input: BranchGeometryInput): readonly Branch[] {
  const { tree } = input;
  const routable: RoutableBranch[] = [];
  for (const parent of tree.nodes) {
    const children = tree.childrenOf(parent.id);
    if (children.length === 0) continue;
    const parentCenter = positionOf(input.positions, parent.id);
    const parentHalfWidth = sizeOf(input.sizes, parent.id).width / 2;
    const fork = forkDistance(parentCenter, parentHalfWidth, children, input.positions);
    for (const child of children) {
      const childCenter = positionOf(input.positions, child.id);
      routable.push({
        parentId: parent.id,
        childId: child.id,
        controls: controlPoints(parentCenter, childCenter, fork),
        width: widthAtDepth(tree.depthOf(child.id), input.config),
      });
    }
  }
  return routeBranches(routable, input).map((branch) => ({
    parentId: branch.parentId,
    childId: branch.childId,
    path: new CubicBezierPath(branch.controls),
    width: branch.width,
  }));
}

/** Start width thins per level (`widthPerLevel^(level-1)`), end width is `taper` of the start (spec R5). */
export function widthAtDepth(childDepth: number, config: BranchConfig): BranchWidth {
  const start = config.rootWidth * config.widthPerLevel ** (childDepth - 1);
  return { start, end: start * config.taper };
}

/** All siblings share one fork distance (from the mean horizontal reach) so their first control points coincide. */
function forkDistance(
  parentCenter: Point,
  parentHalfWidth: number,
  siblings: readonly { id: NodeId }[],
  positions: NodePositions,
): number {
  const meanReach =
    siblings.reduce((sum, sibling) => sum + Math.abs(positionOf(positions, sibling.id).x - parentCenter.x), 0) /
    siblings.length;
  const reachBeyondEdge = Math.max(0, meanReach - parentHalfWidth);
  return parentHalfWidth + Math.max(MIN_HORIZONTAL_HANDLE_PX, reachBeyondEdge * FORK_DISTANCE_FRACTION);
}

function controlPoints(parentCenter: Point, childCenter: Point, fork: number): CubicControlPoints {
  const direction = Math.sign(childCenter.x - parentCenter.x) || 1;
  const settle = Math.max(MIN_HORIZONTAL_HANDLE_PX, Math.abs(childCenter.x - parentCenter.x) * SETTLE_DISTANCE_FRACTION);
  return {
    start: parentCenter,
    control1: { x: parentCenter.x + direction * fork, y: parentCenter.y },
    control2: { x: childCenter.x - direction * settle, y: childCenter.y },
    end: childCenter,
  };
}

function sizeOf(sizes: NodeSizeMap, id: NodeId): NodeSize {
  const size = sizes.get(id);
  if (size === undefined) throw new Error(`No node size for node [${id}]; sizes come from resolveNodeSizes`);
  return size;
}

/** Fails plainly when a (host-supplied) layout stage left a node unpositioned instead of producing NaN geometry. */
export function positionOf(positions: NodePositions, id: NodeId): Point {
  const position = positions.get(id);
  if (position === undefined) throw new Error(`Layout pipeline produced no position for node [${id}]`);
  return position;
}
