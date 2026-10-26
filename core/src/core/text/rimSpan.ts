import type { BranchPath } from '../geometry/branchPath';
import type { NodeBox, NodeShape } from '../shape/nodeShape';

/** Arc-length interval `[start, end]` along a branch path. */
export interface ArcSpan {
  readonly start: number;
  readonly end: number;
}

export function spanLength(span: ArcSpan): number {
  return Math.max(0, span.end - span.start);
}

/** Bisection steps; 2^-24 of the path length is far below a pixel for any realistic branch. */
const RIM_BISECTION_STEPS = 24;

/**
 * The visible part of a center-to-center branch (spec R9, R14): from where it leaves the parent's rim to
 * where it enters the child's rim. Found by bisection on `shape.contains`, so it works for any shape the
 * path crosses once. Overlapping nodes yield an empty span.
 */
export function rimToRimSpan(path: BranchPath, parent: NodeBox, child: NodeBox, shape: NodeShape): ArcSpan {
  const insideParent = (s: number) => shape.contains(parent, path.sampleAt(s).point);
  const insideChild = (s: number) => shape.contains(child, path.sampleAt(s).point);
  if (insideParent(path.length) || insideChild(0)) return { start: path.length, end: path.length };
  const start = boundary(0, path.length, insideParent);
  const end = boundary(start, path.length, (s) => !insideChild(s));
  return { start, end };
}

/** Last arc length where `holds` is still true, given `holds(lo)` and `!holds(hi)`. */
function boundary(lo: number, hi: number, holds: (s: number) => boolean): number {
  let low = lo;
  let high = hi;
  for (let i = 0; i < RIM_BISECTION_STEPS; i++) {
    const mid = (low + high) / 2;
    if (holds(mid)) low = mid;
    else high = mid;
  }
  return low;
}
