import type { NodePositions } from '../layout/layoutTypes';
import type { NodeId, Point, Side } from '../model/node';
import type { MindmapTree } from '../model/tree';
import type { NodeBox, NodeShape } from '../shape/nodeShape';
import type { NodeSizeMap } from '../size/nodeSizeResolver';

/** The part of a `Scene` hit testing reads (scene coordinates). */
export interface HitScene {
  readonly tree: MindmapTree;
  readonly positions: NodePositions;
  readonly sizes: NodeSizeMap;
}

/** Radius of the round hover buttons around a node, in scene px. */
export const HANDLE_RADIUS = 10;
/** Clear space between a node's bounding box and its hover buttons, in scene px. */
export const HANDLE_GAP = 6;

/**
 * Hover button of a node (spec I4): "+" on the outer side adds a child.
 * WHY-NOT a delete "x": deleting in a note is destructive, so the map does not offer it (the `delete` edit request
 * stays in the protocol for hosts that offer it through their own UI).
 */
export interface NodeHandle {
  readonly kind: 'add-child';
  readonly nodeId: NodeId;
  readonly center: Point;
  readonly side: Side;
}

export type PointerTarget =
  | { readonly kind: 'empty' }
  | { readonly kind: 'node'; readonly nodeId: NodeId }
  | { readonly kind: 'handle'; readonly handle: NodeHandle }
  /**
   * Bare canvas inside the hovered node's hover area (see `inHoverArea`), e.g. the gap on the way to its "+":
   * keeps the buttons shown, but is neither a node nor a button (pressing there pans).
   */
  | { readonly kind: 'near-handles'; readonly nodeId: NodeId };

const EMPTY_TARGET: PointerTarget = { kind: 'empty' };
const NO_IDS: ReadonlySet<NodeId> = new Set();
/** Unit x direction of each side's "outer" edge. */
const OUTWARD_X: Readonly<Record<Side, number>> = { left: -1, right: 1 };

export function nodeBoxOf(scene: HitScene, nodeId: NodeId): NodeBox | null {
  const center = scene.positions.get(nodeId);
  const size = scene.sizes.get(nodeId);
  return center === undefined || size === undefined ? null : { center, size };
}

/** Buttons shown while `nodeId` is hovered. The root has a "+" on both sides (its children pick a side). */
export function nodeHandles(scene: HitScene, nodeId: NodeId): readonly NodeHandle[] {
  const box = nodeBoxOf(scene, nodeId);
  if (box === null) return [];
  const side = scene.tree.sideOf(nodeId);
  if (side === null) return [addChildHandle(box, nodeId, 'left'), addChildHandle(box, nodeId, 'right')];
  return [addChildHandle(box, nodeId, side)];
}

/**
 * Hover area of a node while its buttons show: the smallest rectangle around its bounding box and its buttons.
 * WHY: the buttons sit `HANDLE_GAP` outside the node, so without this the pointer crossing the gap would drop the
 * hover and hide the "+" before it could be reached.
 */
export function inHoverArea(scene: HitScene, nodeId: NodeId, point: Point): boolean {
  const box = nodeBoxOf(scene, nodeId);
  if (box === null) return false;
  const halfWidth = box.size.width / 2;
  const halfHeight = box.size.height / 2;
  let left = box.center.x - halfWidth;
  let right = box.center.x + halfWidth;
  let top = box.center.y - halfHeight;
  let bottom = box.center.y + halfHeight;
  for (const { center } of nodeHandles(scene, nodeId)) {
    left = Math.min(left, center.x - HANDLE_RADIUS);
    right = Math.max(right, center.x + HANDLE_RADIUS);
    top = Math.min(top, center.y - HANDLE_RADIUS);
    bottom = Math.max(bottom, center.y + HANDLE_RADIUS);
  }
  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

/** Topmost node whose shape contains `point`, skipping `excludedIds` (e.g. the subtree being dragged). */
export function nodeAt(scene: HitScene, point: Point, shape: NodeShape, excludedIds: ReadonlySet<NodeId> = NO_IDS): NodeId | null {
  // Nodes are painted in data order, so the last one is on top.
  for (let i = scene.tree.nodes.length - 1; i >= 0; i -= 1) {
    const id = (scene.tree.nodes[i] as { readonly id: NodeId }).id;
    if (excludedIds.has(id)) continue;
    const box = nodeBoxOf(scene, id);
    if (box !== null && shape.contains(box, point)) return id;
  }
  return null;
}

/** Handles are rebuilt from the scene on every query, so compare them by what they do, not by identity. */
export function sameHandle(a: NodeHandle | null, b: NodeHandle | null): boolean {
  if (a === null || b === null) return a === b;
  return a.kind === b.kind && a.nodeId === b.nodeId && a.side === b.side;
}

export function handleAt(handles: readonly NodeHandle[], point: Point): NodeHandle | null {
  return handles.find((handle) => Math.hypot(point.x - handle.center.x, point.y - handle.center.y) <= HANDLE_RADIUS) ?? null;
}

/**
 * What is under `point`: the buttons of the currently hovered node (`activeNodeId`, the node whose buttons show)
 * win, since they sit just outside it and may overlap a neighbour; then nodes; then the hovered node's hover area;
 * else empty canvas.
 */
export function pointerTargetAt(scene: HitScene, point: Point, shape: NodeShape, activeNodeId: NodeId | null): PointerTarget {
  if (activeNodeId !== null) {
    const handle = handleAt(nodeHandles(scene, activeNodeId), point);
    if (handle !== null) return { kind: 'handle', handle };
  }
  const nodeId = nodeAt(scene, point, shape);
  if (nodeId !== null) return { kind: 'node', nodeId };
  if (activeNodeId !== null && inHoverArea(scene, activeNodeId, point)) return { kind: 'near-handles', nodeId: activeNodeId };
  return EMPTY_TARGET;
}

function addChildHandle(box: NodeBox, nodeId: NodeId, side: Side): NodeHandle {
  const reach = box.size.width / 2 + HANDLE_GAP + HANDLE_RADIUS;
  return { kind: 'add-child', nodeId, side, center: { x: box.center.x + OUTWARD_X[side] * reach, y: box.center.y } };
}
