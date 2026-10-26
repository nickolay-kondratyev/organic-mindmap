import { GOLDEN_RATIO } from '../math/goldenRatio';

/**
 * Root-branch bow (spec R21): maps a first-level node's normalized vertical distance from the root
 * (0 = level with root, 1 = farthest) to a normalized extra horizontal offset (0..1).
 */
export type BowCurve = (normalizedVerticalDistance: number) => number;


/** Concave bow: pushes out quickly near the root and flattens toward the extremes, golden-ratio exponent. */
export const goldenRatioBowCurve: BowCurve = (t) => clampUnit(t) ** (1 / GOLDEN_RATIO);

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
