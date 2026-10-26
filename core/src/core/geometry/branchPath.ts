import type { NodeId, Point } from '../model/node';

/** A point on a path plus the unit tangent there; what glyph placement and tapered outlines both need. */
export interface PathSample {
  readonly point: Point;
  /** Unit vector in the direction of travel (parent -> child). */
  readonly tangent: Point;
}

/**
 * Shared branch path representation: arc-length parametrised so text-along-curve and branch rendering
 * (built in parallel) agree on where things are. `arcLength` is clamped to `[0, length]`.
 */
export interface BranchPath {
  readonly length: number;
  sampleAt(arcLength: number): PathSample;
}

/** Limb thickness in px where it leaves the parent and where it reaches the child (spec R5). */
export interface BranchWidth {
  readonly start: number;
  readonly end: number;
}

/** One parent -> child link with its geometry; the renderer draws branches center to center (spec R9). */
export interface Branch {
  readonly parentId: NodeId;
  readonly childId: NodeId;
  readonly path: BranchPath;
  readonly width: BranchWidth;
}

/** Straight segment; the scaffold default and a handy synthetic curve for tests. */
export class StraightPath implements BranchPath {
  readonly length: number;
  private readonly direction: Point;

  constructor(
    private readonly from: Point,
    private readonly to: Point,
  ) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    this.length = Math.hypot(dx, dy);
    this.direction = this.length === 0 ? { x: 1, y: 0 } : { x: dx / this.length, y: dy / this.length };
  }

  sampleAt(arcLength: number): PathSample {
    const s = Math.min(this.length, Math.max(0, arcLength));
    return {
      point: { x: this.from.x + this.direction.x * s, y: this.from.y + this.direction.y * s },
      tangent: this.direction,
    };
  }
}
