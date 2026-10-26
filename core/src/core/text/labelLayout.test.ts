import { StraightPath } from '../geometry/branchPath';
import type { BranchTextFitConfig } from '../config/config';
import { GlyphRun } from './glyphRun';
import { layoutBranchLabel, layoutNodeLabel } from './labelLayout';
import { rimToRimSpan } from './rimSpan';
import { ellipseShape } from '../shape/nodeShape';

const LIMITS: BranchTextFitConfig = { paddingPx: 4, minPaddingPx: 0, minLetterSpacingEm: 0, minFontScale: 1 };
const STYLE = { sizePx: 10, letterSpacingEm: 0 };
// Four 1em glyphs -> 40px at 10px.
const RUN = new GlyphRun([1, 1, 1, 1], 1);

describe('layoutBranchLabel', () => {
  describe('GIVEN a right-side branch with a rim-to-rim span of [50, 150]', () => {
    const path = new StraightPath({ x: 0, y: 0 }, { x: 200, y: 0 });
    const layout = layoutBranchLabel(path, { start: 50, end: 150 }, RUN, STYLE, LIMITS);

    it('WHEN laid out THEN the label is centered between the rims', () => {
      expect(layout.glyphs.map((g) => g.center.x)).toEqual([85, 95, 105, 115]);
    });
  });

  describe('GIVEN a left-side branch running from x=0 to x=-200 with a span of [50, 150]', () => {
    const path = new StraightPath({ x: 0, y: 0 }, { x: -200, y: 0 });
    const layout = layoutBranchLabel(path, { start: 50, end: 150 }, RUN, STYLE, LIMITS);

    it('WHEN laid out THEN glyphs run left to right on screen', () => {
      expect(layout.glyphs.map((g) => g.center.x)).toEqual([-115, -105, -95, -85]);
    });

    it('WHEN laid out THEN glyphs are upright', () => {
      const angle = layout.glyphs[0]?.angle ?? Number.NaN;
      expect(Math.cos(angle)).toBeCloseTo(1);
    });
  });

  describe('GIVEN a span too short for all glyphs at the smallest font', () => {
    const path = new StraightPath({ x: 0, y: 0 }, { x: 200, y: 0 });
    const layout = layoutBranchLabel(path, { start: 50, end: 75 }, RUN, STYLE, LIMITS);

    it('WHEN laid out THEN overflowing glyphs are dropped', () => {
      expect(layout.glyphs.length).toBe(2);
    });

    it('WHEN laid out THEN the last kept glyph ends before the span end', () => {
      const lastCenter = layout.glyphs[layout.glyphs.length - 1]?.center.x ?? Number.POSITIVE_INFINITY;
      expect(lastCenter + RUN.glyphWidthPx(1, layout.sizePx) / 2).toBeLessThanOrEqual(75);
    });
  });
});

describe('layoutNodeLabel', () => {
  // GIVEN a node centered at (100, 50)
  const center = { x: 100, y: 50 };

  it('WHEN laid out THEN it is centered on the node', () => {
    const layout = layoutNodeLabel(center, RUN, STYLE);
    expect(layout.glyphs.map((g) => g.center)).toEqual([
      { x: 85, y: 50 },
      { x: 95, y: 50 },
      { x: 105, y: 50 },
      { x: 115, y: 50 },
    ]);
  });

  it('WHEN laid out THEN the style font size is used', () => {
    expect(layoutNodeLabel(center, RUN, STYLE).sizePx).toBe(10);
  });
});

describe('GIVEN a child node larger than its parent (data size override or depthScale > 1)', () => {
  // Parent 40px wide at x=0, child 160px wide at x=200: rims at x=20 and x=120.
  const parent = { center: { x: 0, y: 0 }, size: { width: 40, height: 20 } };
  const child = { center: { x: 200, y: 0 }, size: { width: 160, height: 60 } };
  const path = new StraightPath(parent.center, child.center);
  const span = rimToRimSpan(path, parent, child, ellipseShape);
  const layout = layoutBranchLabel(path, span, RUN, STYLE, LIMITS);

  it('WHEN laid out THEN the label is centered between the parent rim and the larger child rim', () => {
    // Span [20, 120], 40px label -> glyph centers 55..85.
    expect(layout.glyphs.map((g) => Math.round(g.center.x))).toEqual([55, 65, 75, 85]);
  });

  it('WHEN laid out THEN all glyphs are kept at full size', () => {
    expect([layout.glyphs.length, layout.sizePx]).toEqual([4, 10]);
  });
});
