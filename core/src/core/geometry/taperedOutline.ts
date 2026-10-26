import { GOLDEN_RATIO } from '../math/goldenRatio';
import type { Point } from '../model/node';
import type { Branch, PathSample } from './branchPath';

/** Closed polygon (scene coordinates) that the renderer fills to draw one limb (spec R5, R7). */
export type BranchOutline = readonly Point[];

/**
 * Evenly spaced samples (by arc length) per edge; they carry the width profile and the bulge. Curvature is
 * handled separately by `subdivide`, because a uniform step alone left visible corners where a steep limb's
 * curvature bunches up near its ends (short settle handle, hundreds of px of vertical travel).
 */
export const OUTLINE_BASE_SAMPLES = 32;
/**
 * A gap between two samples is split while the path turns more than this across it, so every polygon corner
 * stays below what the eye reads as a kink. Cost scales with total turning (~180 deg / 3 deg = 60 extra points
 * for a U-shaped limb), not with length or zoom, and straight limbs pay nothing.
 */
const MAX_TURN_PER_SEGMENT_RAD = (3 * Math.PI) / 180;
/**
 * Cap on halvings per base gap (2^6 = 64 pieces). Only bites at a cusp, where the tangent flips and no amount of
 * splitting makes the turn small; without it that would recurse forever.
 */
const MAX_SUBDIVISION_DEPTH = 6;
/**
 * Width profile exponent: `(1 - t)^phi` thins fast after leaving the parent and eases into the child, like a
 * brush stroke lifting off, instead of a mechanical linear wedge.
 */
const TAPER_EXPONENT = GOLDEN_RATIO;
/** Integer hash constants (FNV-1a 32-bit) for a cheap deterministic per-branch seed. */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Turns a branch into a filled, tapered outline. One edge bulges by `asymmetry` (a half-sine along the
 * limb) and which edge that is comes from a hash of the child id, so the look is hand-made yet identical
 * on every render (spec R7, R22, Q1).
 */
export function taperedOutline(branch: Branch, asymmetry: number): BranchOutline {
  const { path, width } = branch;
  const bulgeOnLeft = hashId(branch.childId) % 2 === 0;
  const left: Point[] = [];
  const right: Point[] = [];
  for (const { t, sample } of edgeSamples(path)) {
    const { point, tangent } = sample;
    const normal = { x: -tangent.y, y: tangent.x };
    const halfWidth = widthAt(width.start, width.end, t) / 2;
    const bulge = halfWidth * asymmetry * Math.sin(Math.PI * t);
    const leftHalf = halfWidth + (bulgeOnLeft ? bulge : 0);
    const rightHalf = halfWidth + (bulgeOnLeft ? 0 : bulge);
    left.push({ x: point.x + normal.x * leftHalf, y: point.y + normal.y * leftHalf });
    right.push({ x: point.x - normal.x * rightHalf, y: point.y - normal.y * rightHalf });
  }
  return [...left, ...right.reverse()];
}

/** A path sample tagged with its arc-length fraction `t` (0 at the parent, 1 at the child). */
interface OutlineSample {
  readonly t: number;
  readonly sample: PathSample;
}

/** Uniform base samples, with extra ones inserted wherever the path bends faster than one segment can follow. */
function edgeSamples(path: Branch['path']): OutlineSample[] {
  const at = (t: number): OutlineSample => ({ t, sample: path.sampleAt(t * path.length) });
  let previous = at(0);
  const samples: OutlineSample[] = [previous];
  for (let i = 1; i <= OUTLINE_BASE_SAMPLES; i += 1) {
    const next = at(i / OUTLINE_BASE_SAMPLES);
    subdivide(previous, next, MAX_SUBDIVISION_DEPTH, at, samples);
    samples.push(next);
    previous = next;
  }
  return samples;
}

/** Appends the samples strictly between `from` and `to` (in order) needed to keep each gap's turn small. */
function subdivide(
  from: OutlineSample,
  to: OutlineSample,
  depthLeft: number,
  at: (t: number) => OutlineSample,
  out: OutlineSample[],
): void {
  if (depthLeft === 0 || turnBetween(from.sample.tangent, to.sample.tangent) <= MAX_TURN_PER_SEGMENT_RAD) return;
  const middle = at((from.t + to.t) / 2);
  subdivide(from, middle, depthLeft - 1, at, out);
  out.push(middle);
  subdivide(middle, to, depthLeft - 1, at, out);
}

/** Unsigned angle between two unit vectors, in radians. */
function turnBetween(a: Point, b: Point): number {
  return Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y));
}

/** Eased taper from `start` at t = 0 to `end` at t = 1; strictly decreasing when `end < start`. */
export function widthAt(start: number, end: number, t: number): number {
  return end + (start - end) * (1 - t) ** TAPER_EXPONENT;
}

/** FNV-1a over the UTF-16 code units: tiny, dependency-free, stable across runs and platforms. */
function hashId(id: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}
