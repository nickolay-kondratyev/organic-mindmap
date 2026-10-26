import type { Point } from '../model/node';

/** Axis-aligned box in scene coordinates (inclusive edges). */
export interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export function inflate(box: Box, margin: number): Box {
  return { minX: box.minX - margin, maxX: box.maxX + margin, minY: box.minY - margin, maxY: box.maxY + margin };
}

export function pointInBox(box: Box, point: Point): boolean {
  return point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY;
}

/** Touching edges count as overlapping, so a prefilter built on this never drops a pair that could still touch. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}
