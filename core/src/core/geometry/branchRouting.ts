import type { NodeId, NodeSize, Point } from '../model/node';
import type { BranchWidth } from './branchPath';
import { pointOnCubic, type CubicControlPoints } from './cubicBezierPath';
import type { BranchGeometryInput } from './branchGeometry';
import { boxesOverlap, inflate, pointInBox, type Box } from './box';

/** A branch while its control points are still being adjusted; becomes a `Branch` once routed. */
export interface RoutableBranch {
  readonly parentId: NodeId;
  readonly childId: NodeId;
  readonly controls: CubicControlPoints;
  readonly width: BranchWidth;
}

/** Points per curve used for overlap checks. Enough to catch a node-sized box; cheap enough for every paint. */
const ROUTING_SAMPLES = 24;
/**
 * Only the interior of a curve is routed, both around nodes and away from other limbs. Near the endpoints moving
 * the inner control points barely moves the curve (Bernstein weight 3t(1-t) -> 0), so clearing an obstacle there
 * takes a huge bulge that bounces the whole limb; if the endpoint itself is within clearance it cannot clear at
 * all and every pass adds another nudge. Clearance next to the nodes is the collision layout's job (R23), and
 * siblings and parent/child chains legitimately touch there anyway.
 */
const ROUTING_INTERIOR_FROM = 0.15;
const ROUTING_INTERIOR_TO = 0.85;
/** Extra air between a limb's edge and an unrelated node or another limb, in px. */
const CLEARANCE_PX = 6;
/**
 * Moving both inner control points vertically by `d` moves the curve's middle by about 0.75 d (cubic
 * Bernstein weights at t = 0.5), so a gain above 1/0.75 clears an overlap in few passes.
 */
const NUDGE_GAIN = 1.5;
/**
 * Ceiling on the iteration: good enough for a node-sized obstacle or an overlap after a drag; a maze of
 * obstacles is deliberately not solved (spec R8 asks for simple separation, not a physics simulation).
 */
const MAX_ROUTING_PASSES = 6;
/** Direction a curve escapes when the obstacle is exactly centred on it; any fixed choice keeps it deterministic. */
const DEFAULT_ESCAPE_DIRECTION = -1;

/**
 * Routes limbs around unrelated nodes (spec R8) and keeps overlapping limbs apart (R8 sub-bullet) by nudging
 * the two inner control points vertically. Deterministic and purely geometric.
 *
 * Cost: sample-level checks only run for a limb and an obstacle (node box or other limb) whose bounding boxes,
 * inflated by the clearance, overlap; a curve stays inside its control points' box, so the skipped pairs could
 * never have touched and the routed shapes are exactly those of a full scan. Ceiling: the box prefilter itself
 * is still O(branches * nodes + branches^2) per pass (`npm run bench` shows where it stands). Upgrade path: a
 * spatial grid over the boxes.
 */
export function routeBranches(branches: readonly RoutableBranch[], input: BranchGeometryInput): RoutableBranch[] {
  const obstacles = nodeBoxes(input);
  const routed = branches.map((branch) => avoidUnrelatedNodes(branch, obstacles));
  return separateOverlappingBranches(routed);
}

interface NodeBox {
  readonly id: NodeId;
  readonly box: Box;
}

function nodeBoxes(input: BranchGeometryInput): NodeBox[] {
  const boxes: NodeBox[] = [];
  for (const node of input.tree.nodes) {
    const center = input.positions.get(node.id);
    const size = input.sizes.get(node.id);
    if (center === undefined || size === undefined) continue;
    boxes.push({ id: node.id, box: boxAround(center, size) });
  }
  return boxes;
}

function avoidUnrelatedNodes(branch: RoutableBranch, allNodes: readonly NodeBox[]): RoutableBranch {
  const obstacles = unrelatedNodeBoxes(branch, allNodes);
  if (obstacles.length === 0) return branch;
  let current = branch;
  for (let pass = 0; pass < MAX_ROUTING_PASSES; pass += 1) {
    const escape = deepestPenetration(current, obstacles);
    if (escape === null) return current;
    current = nudgeVertically(current, escape.direction * escape.depth * NUDGE_GAIN);
  }
  return current;
}

/**
 * How far from a limb's centre line an obstacle can still be touched, anywhere along it: the widest half width plus
 * the clearance. Inflating a box by it makes the box-level check safe for every sample.
 */
function reach(width: BranchWidth): number {
  return Math.max(width.start, width.end) / 2 + CLEARANCE_PX;
}

/**
 * Boxes of nodes that are neither end of the branch and do not already cover an endpoint (that is layout's job).
 * Nudges keep a limb's x extent and move it vertically by at most the deepest penetration each pass, so a node
 * further away than the limb could travel in all passes is skipped up front.
 */
function unrelatedNodeBoxes(branch: RoutableBranch, allNodes: readonly NodeBox[]): Box[] {
  const boxes: Box[] = [];
  const nearby = inflate(controlBox(branch.controls), reach(branch.width) + maxTravel(branch, allNodes));
  for (const node of allNodes) {
    if (node.id === branch.parentId || node.id === branch.childId) continue;
    if (!boxesOverlap(nearby, node.box)) continue;
    if (pointInBox(node.box, branch.controls.start) || pointInBox(node.box, branch.controls.end)) continue;
    boxes.push(node.box);
  }
  return boxes;
}

/**
 * Upper bound on how far the curve can move vertically over all avoidance passes: each pass moves it by at most
 * `NUDGE_GAIN` times the deepest penetration, and a penetration is never deeper than the tallest inflated box.
 */
function maxTravel(branch: RoutableBranch, allNodes: readonly NodeBox[]): number {
  let tallest = 0;
  for (const node of allNodes) tallest = Math.max(tallest, node.box.maxY - node.box.minY);
  return MAX_ROUTING_PASSES * NUDGE_GAIN * (tallest + 2 * reach(branch.width));
}

interface Escape {
  readonly direction: number;
  readonly depth: number;
}

/**
 * The worst (deepest) intrusion of the branch's interior edge into any obstacle, with the shorter vertical way out.
 * WHY-NOT resample the interior like `interiorOverlap`: the whole-curve grid with the ends skipped keeps routed
 * shapes (and the reference view) stable for limbs whose ends were never in the way.
 */
function deepestPenetration(branch: RoutableBranch, obstacles: readonly Box[]): Escape | null {
  const nearby = inflate(controlBox(branch.controls), reach(branch.width));
  const candidates = obstacles.filter((obstacle) => boxesOverlap(nearby, obstacle));
  if (candidates.length === 0) return null;
  let worst: Escape | null = null;
  for (let i = 0; i <= ROUTING_SAMPLES; i += 1) {
    const t = i / ROUTING_SAMPLES;
    if (t < ROUTING_INTERIOR_FROM || t > ROUTING_INTERIOR_TO) continue;
    const point = pointOnCubic(branch.controls, t);
    const margin = halfWidthAt(branch.width, t) + CLEARANCE_PX;
    for (const obstacle of candidates) {
      const inflated = inflate(obstacle, margin);
      if (!pointInBox(inflated, point)) continue;
      const centerY = (inflated.minY + inflated.maxY) / 2;
      const direction = Math.sign(point.y - centerY) || DEFAULT_ESCAPE_DIRECTION;
      const depth = direction < 0 ? point.y - inflated.minY : inflated.maxY - point.y;
      if (worst === null || depth > worst.depth) worst = { direction, depth };
    }
  }
  return worst;
}

/** A limb during separation with its interior samples computed once per shape (they are compared against every neighbour). */
interface SampledLimb {
  readonly branch: RoutableBranch;
  /** `controlBox` inflated by `reach`: anything a sample could touch lies inside. */
  readonly footprint: Box;
  readonly points: readonly Point[];
  readonly halfWidths: readonly number[];
}

function sampleInterior(branch: RoutableBranch): SampledLimb {
  const points: Point[] = [];
  const halfWidths: number[] = [];
  for (let i = 0; i <= ROUTING_SAMPLES; i += 1) {
    const t = ROUTING_INTERIOR_FROM + (i / ROUTING_SAMPLES) * (ROUTING_INTERIOR_TO - ROUTING_INTERIOR_FROM);
    points.push(pointOnCubic(branch.controls, t));
    halfWidths.push(halfWidthAt(branch.width, t));
  }
  return { branch, footprint: inflate(controlBox(branch.controls), reach(branch.width)), points, halfWidths };
}

function separateOverlappingBranches(branches: readonly RoutableBranch[]): RoutableBranch[] {
  const limbs = branches.map(sampleInterior);
  for (let pass = 0; pass < MAX_ROUTING_PASSES; pass += 1) {
    let moved = false;
    for (let i = 0; i < limbs.length; i += 1) {
      for (let j = i + 1; j < limbs.length; j += 1) {
        const a = limbs[i] as SampledLimb;
        const b = limbs[j] as SampledLimb;
        if (!mayOverlap(a.branch, b.branch) || !boxesOverlap(a.footprint, b.footprint)) continue;
        const overlap = interiorOverlap(a, b);
        if (overlap === null) continue;
        const shift = (overlap.deficit / 2) * NUDGE_GAIN;
        limbs[i] = sampleInterior(nudgeVertically(a.branch, overlap.directionForA * shift));
        limbs[j] = sampleInterior(nudgeVertically(b.branch, -overlap.directionForA * shift));
        moved = true;
      }
    }
    if (!moved) break;
  }
  return limbs.map((limb) => limb.branch);
}

/** Siblings fork from one trunk and a parent's limb meets its child's limbs at the node: those touch by design. */
function mayOverlap(a: RoutableBranch, b: RoutableBranch): boolean {
  return a.parentId !== b.parentId && a.childId !== b.parentId && b.childId !== a.parentId;
}

interface Overlap {
  /** How much closer the two edges are than they should be, in px. */
  readonly deficit: number;
  readonly directionForA: number;
}

function interiorOverlap(a: SampledLimb, b: SampledLimb): Overlap | null {
  let worst: Overlap | null = null;
  for (let i = 0; i < a.points.length; i += 1) {
    const pa = a.points[i] as Point;
    const halfA = a.halfWidths[i] as number;
    for (let j = 0; j < b.points.length; j += 1) {
      const pb = b.points[j] as Point;
      const required = halfA + (b.halfWidths[j] as number) + CLEARANCE_PX;
      const deficit = required - Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (deficit <= 0 || (worst !== null && deficit <= worst.deficit)) continue;
      worst = { deficit, directionForA: Math.sign(pa.y - pb.y) || DEFAULT_ESCAPE_DIRECTION };
    }
  }
  return worst;
}

/** Linear width profile is enough for clearance checks; the drawn outline uses the eased profile. */
function halfWidthAt(width: BranchWidth, t: number): number {
  return (width.start + (width.end - width.start) * t) / 2;
}

function nudgeVertically(branch: RoutableBranch, dy: number): RoutableBranch {
  const { controls } = branch;
  return {
    ...branch,
    controls: {
      ...controls,
      control1: { x: controls.control1.x, y: controls.control1.y + dy },
      control2: { x: controls.control2.x, y: controls.control2.y + dy },
    },
  };
}

/** A cubic never leaves the convex hull of its control points, so their box bounds the whole curve. */
function controlBox({ start, control1, control2, end }: CubicControlPoints): Box {
  return {
    minX: Math.min(start.x, control1.x, control2.x, end.x),
    maxX: Math.max(start.x, control1.x, control2.x, end.x),
    minY: Math.min(start.y, control1.y, control2.y, end.y),
    maxY: Math.max(start.y, control1.y, control2.y, end.y),
  };
}

function boxAround(center: Point, size: NodeSize): Box {
  return {
    minX: center.x - size.width / 2,
    maxX: center.x + size.width / 2,
    minY: center.y - size.height / 2,
    maxY: center.y + size.height / 2,
  };
}
