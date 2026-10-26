import { DEFAULT_SIDE_ORDER, type SideOrder } from '../model/tree';

/**
 * Layout algorithms are selected by `type` (spec L4). Adding a variant extends this union and the
 * exhaustive `switch` in `pipeline.ts` fails to compile until handled.
 *
 * NOTE for the second variant: `resolveConfig` deep-merges `layout` over the bilateral default, so a partial
 * `{ type: 'other' }` would inherit bilateral fields. Pick defaults per `type` in `resolveConfig` at that point.
 */

export interface BilateralLayoutConfig {
  readonly type: 'bilateral';
  /** How first-level nodes without an explicit `side` are split between the sides (spec R19); see `SideOrder`. */
  readonly sideOrder: SideOrder;
  /** Horizontal gap between a parent's and a child's box edges, in px (room for the branch label, R14). */
  readonly horizontalGap: number;
  /** Vertical gap between the box edges of vertically adjacent nodes at the same depth, in px. */
  readonly verticalGap: number;
  /** Extra outward offset of the vertically farthest first-level node, in px (spec R21); scaled by the bow curve. */
  readonly bowOffset: number;
  /** Maximum deterministic hand-drawn offset per axis, in px (spec R22); 0 disables the jitter. */
  readonly jitterAmplitude: number;
  /** Minimum clearance kept between node boxes by the collision stage, in px (spec R23). */
  readonly collisionPadding: number;
}

export type LayoutConfig = BilateralLayoutConfig;

/** A `Record` over the union, so a new layout `type` does not compile until it is listed. */
const KNOWN_LAYOUT_TYPES: Readonly<Record<LayoutConfig['type'], true>> = { bilateral: true };

/** Every layout `type`, for runtime checks and pickers (the union itself cannot be listed at runtime). */
export const LAYOUT_TYPES = Object.keys(KNOWN_LAYOUT_TYPES) as readonly LayoutConfig['type'][];

export function isLayoutType(value: unknown): value is LayoutConfig['type'] {
  return typeof value === 'string' && Object.hasOwn(KNOWN_LAYOUT_TYPES, value);
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  type: 'bilateral',
  sideOrder: DEFAULT_SIDE_ORDER,
  horizontalGap: 120,
  verticalGap: 40,
  bowOffset: 120,
  jitterAmplitude: 6,
  collisionPadding: 8,
};
