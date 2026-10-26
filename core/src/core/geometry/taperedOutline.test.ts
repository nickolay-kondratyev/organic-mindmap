import { DEFAULT_CONFIG } from '../config/config';
import type { Point } from '../model/node';
import { StraightPath, type Branch } from './branchPath';
import { CubicBezierPath } from './cubicBezierPath';
import { OUTLINE_BASE_SAMPLES, taperedOutline, widthAt, type BranchOutline } from './taperedOutline';

/** Straight horizontal limb: the normal is +y, so "left" edge points have y > 0 and "right" edge y < 0. */
const LENGTH = 200;
const branch: Branch = {
  parentId: 'p',
  childId: 'c',
  path: new StraightPath({ x: 0, y: 0 }, { x: LENGTH, y: 0 }),
  width: { start: 40, end: 6 },
};
const { asymmetry } = DEFAULT_CONFIG.branch;

/** Pairs the i-th left point with its mirrored right point and returns the local total width. */
function widthsAlong(outline: BranchOutline): number[] {
  const perEdge = outline.length / 2;
  const left = outline.slice(0, perEdge);
  const right = outline.slice(perEdge).reverse();
  return left.map((l, i) => Math.abs(l.y - (right[i] as Point).y));
}

describe('taperedOutline', () => {
  const outline = taperedOutline(branch, asymmetry);

  it('WHEN walking from parent to child THEN the limb never gets wider (monotonic taper)', () => {
    const widths = widthsAlong(outline);
    const growsSomewhere = widths.some((w, i) => i > 0 && w > (widths[i - 1] as number) + 1e-9);
    expect(growsSomewhere).toBe(false);
  });

  it('WHEN the limb starts THEN it is exactly the start width, and ends at the end width', () => {
    const widths = widthsAlong(outline);
    expect([widths[0], widths[widths.length - 1]]).toEqual([branch.width.start, branch.width.end]);
  });

  it('WHEN asymmetry is on THEN one edge bulges away from the centerline more than the other', () => {
    const perEdge = outline.length / 2;
    const middle = Math.floor(perEdge / 2);
    const leftOffset = Math.abs((outline[middle] as Point).y);
    const rightOffset = Math.abs((outline[outline.length - 1 - middle] as Point).y);
    expect(leftOffset).not.toBeCloseTo(rightOffset, 6);
  });

  it('WHEN asymmetry is zero THEN both edges mirror each other', () => {
    const symmetric = taperedOutline(branch, 0);
    const perEdge = symmetric.length / 2;
    const mirrored = symmetric
      .slice(0, perEdge)
      .every((l, i) => Math.abs(l.y + (symmetric[symmetric.length - 1 - i] as Point).y) < 1e-9);
    expect(mirrored).toBe(true);
  });

  it('WHEN built twice for the same branch THEN the outline is identical (deterministic)', () => {
    expect(taperedOutline(branch, asymmetry)).toEqual(outline);
  });

  it('WHEN two branches differ only by child id THEN the bulge side can differ but the widths cannot', () => {
    const sibling = taperedOutline({ ...branch, childId: 'd' }, asymmetry);
    expect(widthsAlong(sibling)).toEqual(widthsAlong(outline));
  });

  it('WHEN the limb is straight THEN no extra points are spent on it (one point per base sample per edge)', () => {
    expect(outline.length).toBe(2 * (OUTLINE_BASE_SAMPLES + 1));
  });
});

/**
 * Largest corner the eye should not see on a filled limb edge, in degrees. Uniform sampling showed 10-33 degree
 * corners on steep limbs (ticket "smooth curvature").
 */
const MAX_VISIBLE_CORNER_DEG = 5;

/** Largest direction change between consecutive segments of an open polyline, in degrees. */
function sharpestCornerDeg(edge: readonly Point[]): number {
  let sharpest = 0;
  for (let i = 1; i < edge.length - 1; i += 1) {
    const [a, b, c] = [edge[i - 1] as Point, edge[i] as Point, edge[i + 1] as Point];
    const turn = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
    const wrapped = Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
    sharpest = Math.max(sharpest, (wrapped * 180) / Math.PI);
  }
  return sharpest;
}

/**
 * Every default-sized node covers at least this radius around its center (smallest ellipse half-height), so edge
 * points this close to either end are painted over. The settle hook folds the inner edge there (the offset of a
 * curve tighter than the half-width), about 3 px from the child center, so invisibly.
 */
const HIDDEN_UNDER_NODE_PX = (DEFAULT_CONFIG.node.rootSize.height * DEFAULT_CONFIG.node.minScale) / 2;

describe('GIVEN a steep limb (child dragged far below, short settle handle) whose curvature bunches at the ends', () => {
  const start = { x: 0, y: 0 };
  const end = { x: 20, y: 300 };
  const steep: Branch = {
    parentId: 'p',
    childId: 'c',
    path: new CubicBezierPath({ start, control1: { x: 140, y: 0 }, control2: { x: -4, y: 300 }, end }),
    width: { start: 37, end: 5.5 },
  };
  const steepOutline = taperedOutline(steep, asymmetry);
  const perEdge = steepOutline.length / 2;
  const visible = (edge: readonly Point[]): Point[] =>
    edge.filter((p) => Math.min(distance(p, start), distance(p, end)) > HIDDEN_UNDER_NODE_PX);

  it('WHEN outlined THEN the visible left edge has no corner', () => {
    expect(sharpestCornerDeg(visible(steepOutline.slice(0, perEdge)))).toBeLessThan(MAX_VISIBLE_CORNER_DEG);
  });

  it('WHEN outlined THEN the visible right edge has no corner', () => {
    expect(sharpestCornerDeg(visible(steepOutline.slice(perEdge)))).toBeLessThan(MAX_VISIBLE_CORNER_DEG);
  });
});

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('widthAt', () => {
  it('WHEN t goes from 0 to 1 THEN the width eases from start to end', () => {
    expect([widthAt(40, 6, 0), widthAt(40, 6, 1)]).toEqual([40, 6]);
  });
});
