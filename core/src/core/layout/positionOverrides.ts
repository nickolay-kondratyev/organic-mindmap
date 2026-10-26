import type { NodeId, Point, Side } from '../model/node';
import type { MindmapTree } from '../model/tree';
import type { NodeSizeMap } from '../size/nodeSizeResolver';
import { resolveCollisions } from './collisionStage';
import { subtreeIds } from './layoutLookups';
import type { NodePositions } from './layoutTypes';

/**
 * User-chosen node centres (spec I2), keyed by node id, in scene coordinates. Library-local layout state: they
 * survive data updates (ids that no longer exist are ignored) and are reported to the host as events, never
 * written into host data. Iteration order is drop order (oldest first, kept by `withNodeDropped`): when two
 * user-placed nodes overlap, the later drop stays and the earlier one is pushed clear.
 */
export type PositionOverrides = ReadonlyMap<NodeId, Point>;

export const NO_POSITION_OVERRIDES: PositionOverrides = new Map();

export interface PositionOverrideInput {
  readonly tree: MindmapTree;
  readonly sizes: NodeSizeMap;
  /** Clearance for the push-apart, usually `layout.collisionPadding`. */
  readonly padding: number;
  readonly overrides: PositionOverrides;
}

/**
 * A move of `nodeId`'s subtree that brings the node from `from` to `to` (spec I2). `mirrored` when the node ends up
 * on the other side of its parent: the subtree then flips left<->right around the node, so its children keep
 * growing away from the parent instead of pointing back across it.
 */
export interface SubtreeMove {
  readonly nodeId: NodeId;
  readonly from: Point;
  readonly to: Point;
  readonly mirrored: boolean;
}

/**
 * The one flip rule shared by the drag preview, the stored drop and `applyPositionOverrides`, so what is seen
 * while dragging is what is drawn after the drop. `null` when `nodeId` has no position. The root has no parent,
 * so it never mirrors. Comparing before/after (not `tree.sideOf`) lets nested overrides work: parents move first,
 * so a child compares against its parent's already-flipped centre.
 * Ceiling: the drag reads drawn positions (after push-apart), `applyPositionOverrides` the pre-push-apart ones, so
 * a node or parent pushed across the parent's centre line by collisions could flip differently after the drop.
 * Upgrade path if that shows up: store the flip with the override instead of re-deriving it.
 */
export function subtreeMoveTo(positions: NodePositions, tree: MindmapTree, nodeId: NodeId, to: Point): SubtreeMove | null {
  const from = positions.get(nodeId);
  if (from === undefined) return null;
  const parentNode = tree.parentOf(nodeId);
  const parent = parentNode === null ? undefined : positions.get(parentNode.id);
  const mirrored = parent !== undefined && horizontalSideOf(from.x, parent.x) !== horizontalSideOf(to.x, parent.x);
  return { nodeId, from, to, mirrored };
}

/** `subtreeMoveTo` for a drag by scene-unit `offset` from where the node is in `positions`. */
export function subtreeMoveBy(positions: NodePositions, tree: MindmapTree, nodeId: NodeId, offset: Point): SubtreeMove | null {
  const from = positions.get(nodeId);
  return from === undefined ? null : subtreeMoveTo(positions, tree, nodeId, { x: from.x + offset.x, y: from.y + offset.y });
}

/**
 * Which side of `parentX` a centre at `x` is on. Exactly on the line counts as right.
 * WHY-NOT a third "on the line" answer meaning "no change": the drag preview compares against where the node is
 * drawn, while `applyPositionOverrides` compares against its laid-out spot. A binary side keeps both answers equal
 * (drawn side = laid-out side, flipped once per crossing); with a neutral line, right -> line -> left would stay
 * unflipped in the preview but flip on the next scene build.
 */
function horizontalSideOf(x: number, parentX: number): Side {
  return x < parentX ? 'left' : 'right';
}

/** Where `point`, a node of the moved subtree, ends up under `move`. */
function movedPoint(move: SubtreeMove, point: Point): Point {
  const y = point.y + move.to.y - move.from.y;
  const x = move.mirrored ? move.to.x - (point.x - move.from.x) : point.x + move.to.x - move.from.x;
  return { x, y };
}

/** Applies `move` to the node and its whole subtree. Pure: returns a new map. */
export function moveSubtree(positions: NodePositions, tree: MindmapTree, move: SubtreeMove): NodePositions {
  const result = new Map(positions);
  for (const id of subtreeIds(tree, move.nodeId)) {
    const position = result.get(id);
    if (position !== undefined) result.set(id, movedPoint(move, position));
  }
  return result;
}

/**
 * Overrides after a node drag that ended away from any drop target (spec I2): the dragged node gets its new
 * centre, and descendants with an override of their own move (or mirror) with it, since the whole subtree
 * travels with the dragged node (else they would snap back, or un-flip).
 */
export function withNodeDropped(overrides: PositionOverrides, tree: MindmapTree, drop: SubtreeMove): PositionOverrides {
  const result = new Map(overrides);
  for (const id of subtreeIds(tree, drop.nodeId)) {
    const position = result.get(id);
    if (position !== undefined) result.set(id, movedPoint(drop, position));
  }
  // Delete first: `Map.set` on an existing key keeps its old slot, but this is now the latest drop.
  result.delete(drop.nodeId);
  result.set(drop.nodeId, drop.to);
  return result;
}

/** Overrides minus those of `nodeId`'s subtree, so it lands at its layout spot (e.g. after a reparent). */
export function withoutSubtree(overrides: PositionOverrides, tree: MindmapTree, nodeId: NodeId): PositionOverrides {
  const dropped = new Set(subtreeIds(tree, nodeId));
  return new Map([...overrides].filter(([id]) => !dropped.has(id)));
}

/**
 * Places every overridden node at its chosen centre, carrying its subtree along (mirrored when the node crossed
 * its parent, see `subtreeMoveTo`; spec I2), then pushes nodes apart
 * (R23) with the overridden subtrees pinned in drop order: laid-out nodes always yield to them, and where two
 * user-placed subtrees overlap the earlier drop yields, so the latest drop stays exactly where the user put it.
 * Parents are placed before children, so a child with its own override still ends up at it, and decides its own
 * flip against its parent's already-moved centre.
 *
 * Without overrides the input is returned as-is (no extra collision pass), so untouched maps render exactly as
 * the layout pipeline produced them.
 */
export function applyPositionOverrides(positions: NodePositions, input: PositionOverrideInput): NodePositions {
  const { tree, overrides } = input;
  const known = tree.nodes.filter((node) => overrides.has(node.id) && positions.has(node.id) && node.parentId !== null);
  if (known.length === 0) return positions;

  let result = positions;
  for (const node of [...known].sort((a, b) => tree.depthOf(a.id) - tree.depthOf(b.id))) {
    const target = overrides.get(node.id) as Point;
    const move = subtreeMoveTo(result, tree, node.id, target);
    if (move !== null) result = moveSubtree(result, tree, move);
  }
  const knownIds = new Set(known.map((node) => node.id));
  const pinnedGroups = [...overrides.keys()]
    .filter((id) => knownIds.has(id))
    .map((id) => new Set<NodeId>(subtreeIds(tree, id)));
  return resolveCollisions(result, { tree, sizes: input.sizes, padding: input.padding, pinnedGroups });
}
