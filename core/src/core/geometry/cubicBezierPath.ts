import type { Point } from '../model/node';
import type { BranchPath, PathSample } from './branchPath';

/** The four control points of a cubic Bezier: `start` and `end` are node centers (spec R9). */
export interface CubicControlPoints {
  readonly start: Point;
  readonly control1: Point;
  readonly control2: Point;
  readonly end: Point;
}

/**
 * Number of straight pieces the curve is cut into to map arc length -> parameter t. Branches are a few
 * hundred px long, so this keeps the arc-length error well under a pixel while staying cheap per paint.
 */
const ARC_LENGTH_SEGMENTS = 64;
/** Parameter step used for the tangent when the analytic derivative vanishes (coincident control points). */
const TANGENT_FALLBACK_STEP = 1e-3;

/** Evaluates the cubic at parameter `t` (not arc length); routing samples control polygons with this. */
export function pointOnCubic({ start, control1, control2, end }: CubicControlPoints, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * start.x + b * control1.x + c * control2.x + d * end.x,
    y: a * start.y + b * control1.y + c * control2.y + d * end.y,
  };
}

/**
 * Cubic Bezier parametrised by arc length (spec R5/R12): branch outlines and text-along-curve sample it
 * by distance, so they agree on where a glyph or a width belongs. Built once per branch per paint.
 */
export class CubicBezierPath implements BranchPath {
  readonly length: number;
  /** Cumulative arc length at parameter `i / ARC_LENGTH_SEGMENTS`. */
  private readonly cumulativeLengths: readonly number[];

  constructor(readonly controls: CubicControlPoints) {
    const lengths: number[] = [0];
    let previous = this.pointAt(0);
    for (let i = 1; i <= ARC_LENGTH_SEGMENTS; i += 1) {
      const current = this.pointAt(i / ARC_LENGTH_SEGMENTS);
      lengths.push((lengths[i - 1] as number) + Math.hypot(current.x - previous.x, current.y - previous.y));
      previous = current;
    }
    this.cumulativeLengths = lengths;
    this.length = lengths[ARC_LENGTH_SEGMENTS] as number;
  }

  sampleAt(arcLength: number): PathSample {
    const t = this.parameterAtArcLength(Math.min(this.length, Math.max(0, arcLength)));
    return { point: this.pointAt(t), tangent: this.tangentAt(t) };
  }

  pointAt(t: number): Point {
    return pointOnCubic(this.controls, t);
  }

  private tangentAt(t: number): Point {
    const derivative = this.derivativeAt(t);
    const magnitude = Math.hypot(derivative.x, derivative.y);
    if (magnitude > 0) return { x: derivative.x / magnitude, y: derivative.y / magnitude };
    // Zero derivative (e.g. control1 === start): fall back to the chord of a tiny step.
    const ahead = this.pointAt(Math.min(1, t + TANGENT_FALLBACK_STEP));
    const behind = this.pointAt(Math.max(0, t - TANGENT_FALLBACK_STEP));
    const chord = Math.hypot(ahead.x - behind.x, ahead.y - behind.y);
    return chord === 0 ? { x: 1, y: 0 } : { x: (ahead.x - behind.x) / chord, y: (ahead.y - behind.y) / chord };
  }

  private derivativeAt(t: number): Point {
    const { start, control1, control2, end } = this.controls;
    const u = 1 - t;
    const a = 3 * u * u;
    const b = 6 * u * t;
    const c = 3 * t * t;
    return {
      x: a * (control1.x - start.x) + b * (control2.x - control1.x) + c * (end.x - control2.x),
      y: a * (control1.y - start.y) + b * (control2.y - control1.y) + c * (end.y - control2.y),
    };
  }

  /** Binary search in the cumulative table, then linear interpolation inside the segment. */
  private parameterAtArcLength(arcLength: number): number {
    if (this.length === 0) return 0;
    let low = 0;
    let high = ARC_LENGTH_SEGMENTS;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if ((this.cumulativeLengths[mid] as number) <= arcLength) low = mid;
      else high = mid;
    }
    const segmentStart = this.cumulativeLengths[low] as number;
    const segmentEnd = this.cumulativeLengths[high] as number;
    const segmentLength = segmentEnd - segmentStart;
    const fraction = segmentLength === 0 ? 0 : (arcLength - segmentStart) / segmentLength;
    return (low + fraction) / ARC_LENGTH_SEGMENTS;
  }
}
