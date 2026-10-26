import type { NodeId, Point } from '../model/node';
import type { MindmapTree } from '../model/tree';
import type { NodeSizeMap } from '../size/nodeSizeResolver';
import type { LayoutContext, LayoutStage, NodePositions } from './layoutTypes';
import { requirePosition, requireSize } from './layoutLookups';

/**
 * Upper bound on relaxation passes. Pushing one pair apart can create a new overlap with a neighbour, so
 * passes repeat until a pass moves nothing; the bound only guards against unresolvable input (e.g. two
 * nodes of one pinned group overlapping each other), in which case the result is best effort.
 */
const MAX_COLLISION_PASSES = 100;

/** When two centers coincide on the push axis there is no natural direction; push the later node this way. */
const TIE_BREAK_DIRECTION = 1;

/** Overlaps below this are floating-point residue from a previous push, not real overlaps. */
const OVERLAP_EPSILON_PX = 1e-6;

/** Moves are split evenly when both nodes are free to move. */
const SHARED_MOVE_FRACTION = 0.5;

export interface CollisionInput {
  readonly tree: MindmapTree;
  readonly sizes: NodeSizeMap;
  /** Minimum clearance between node boxes, in px. */
  readonly padding: number;
  /**
   * Nodes that never yield to free nodes, e.g. user-dragged subtrees (spec I2), as groups from weakest to
   * strongest: when nodes of two groups overlap, the earlier group yields to the later one (the latest drop wins),
   * so user-placed nodes repel each other too. Nodes of one group never move against each other. A node listed in
   * several groups belongs to the last one. The root is stronger than every group.
   */
  readonly pinnedGroups?: readonly ReadonlySet<NodeId>[];
}

/**
 * How firmly a node holds its place: in an overlap the weaker node takes the whole push, equal free nodes share it.
 * Free nodes are 0, pinned group `i` is `i + 1`, the root is strongest.
 */
type PinRank = number;
const FREE_RANK: PinRank = 0;
const ROOT_RANK: PinRank = Number.POSITIVE_INFINITY;

interface Penetration {
  readonly x: number;
  readonly y: number;
}

/**
 * Spec R23: pushes overlapping node boxes apart until every pair keeps `padding` clearance. Each overlap is
 * resolved along the axis of least penetration (the smallest move that separates the pair). The weaker node of a
 * pair (see `PinRank`) takes the whole push; two free nodes share it; two nodes of one pinned group stay put.
 * Pure: returns a new map, the input is untouched.
 *
 * Ceiling: O(n^2) pair scan per pass, fine for hand-sized maps (hundreds of nodes). Upgrade path: bucket boxes
 * in a uniform grid or a d3-quadtree and only test neighbours.
 */
export function resolveCollisions(positions: NodePositions, input: CollisionInput): NodePositions {
  const ranks = pinRanks(input);
  const result = new Map<NodeId, Point>(positions);
  const ids = [...result.keys()];
  for (let pass = 0; pass < MAX_COLLISION_PASSES; pass += 1) {
    let moved = false;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        moved = separatePair(ids[i] as NodeId, ids[j] as NodeId, result, ranks, input) || moved;
      }
    }
    if (!moved) break;
  }
  return result;
}

/** Stage 4 (spec R23): collision push-apart with only the root pinned. */
export const collisionStage: LayoutStage = {
  name: 'collision',
  run(positions: NodePositions, context: LayoutContext): NodePositions {
    return resolveCollisions(positions, { tree: context.tree, sizes: context.sizes, padding: context.config.collisionPadding });
  },
};

function pinRanks(input: CollisionInput): ReadonlyMap<NodeId, PinRank> {
  const ranks = new Map<NodeId, PinRank>();
  (input.pinnedGroups ?? []).forEach((group, index) => {
    for (const id of group) ranks.set(id, index + 1);
  });
  ranks.set(input.tree.root.id, ROOT_RANK);
  return ranks;
}

/** Returns whether anything moved. */
function separatePair(
  idA: NodeId,
  idB: NodeId,
  positions: Map<NodeId, Point>,
  ranks: ReadonlyMap<NodeId, PinRank>,
  input: CollisionInput,
): boolean {
  const rankA = ranks.get(idA) ?? FREE_RANK;
  const rankB = ranks.get(idB) ?? FREE_RANK;
  if (rankA === rankB && rankA !== FREE_RANK) return false;
  const a = requirePosition(positions, idA);
  const b = requirePosition(positions, idB);
  const penetration = penetrationOf(idA, a, idB, b, input);
  if (penetration === null) return false;

  const alongX = penetration.x <= penetration.y;
  const delta = alongX ? b.x - a.x : b.y - a.y;
  const direction = delta === 0 ? TIE_BREAK_DIRECTION : Math.sign(delta);
  const push = (alongX ? penetration.x : penetration.y) * direction;
  const aShare = rankA > rankB ? 0 : rankA < rankB ? 1 : SHARED_MOVE_FRACTION;
  const bShare = 1 - aShare;
  positions.set(idA, offset(a, alongX, -push * aShare));
  positions.set(idB, offset(b, alongX, push * bShare));
  return true;
}

/** How far the padded boxes overlap on each axis, or `null` when they are clear. */
function penetrationOf(idA: NodeId, a: Point, idB: NodeId, b: Point, input: CollisionInput): Penetration | null {
  const sizeA = requireSize(input.sizes, idA);
  const sizeB = requireSize(input.sizes, idB);
  const x = (sizeA.width + sizeB.width) / 2 + input.padding - Math.abs(b.x - a.x);
  const y = (sizeA.height + sizeB.height) / 2 + input.padding - Math.abs(b.y - a.y);
  return x > OVERLAP_EPSILON_PX && y > OVERLAP_EPSILON_PX ? { x, y } : null;
}

function offset(point: Point, alongX: boolean, amount: number): Point {
  return alongX ? { x: point.x + amount, y: point.y } : { x: point.x, y: point.y + amount };
}
