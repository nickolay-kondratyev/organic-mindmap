import { glyphLabelUnderline, straightLabelUnderline } from './labelUnderline';
import type { LabelLayout } from './labelLayout';

const SIZE_PX = 20;
const BASELINE_EM = 0.35;

describe('glyphLabelUnderline', () => {
  // GIVEN two upright 10px glyphs centered at x=5 and x=15 on y=0, with no gap between them
  const upright: LabelLayout = {
    sizePx: SIZE_PX,
    glyphs: [
      { center: { x: 5, y: 0 }, angle: 0 },
      { center: { x: 15, y: 0 }, angle: 0 },
    ],
  };
  const widths = [10, 10];

  it('WHEN underlined THEN the line starts at the left edge of the first glyph', () => {
    expect(glyphLabelUnderline(upright, widths, BASELINE_EM)?.points[0]?.x).toBeCloseTo(0);
  });

  it('WHEN underlined THEN the line ends at the right edge of the last glyph', () => {
    expect(glyphLabelUnderline(upright, widths, BASELINE_EM)?.points.at(-1)?.x).toBeCloseTo(20);
  });

  it('WHEN underlined THEN every point sits below the baseline', () => {
    const baselineY = BASELINE_EM * SIZE_PX;
    const points = glyphLabelUnderline(upright, widths, BASELINE_EM)?.points ?? [];
    expect(points.filter((point) => point.y <= baselineY)).toEqual([]);
  });

  it('WHEN underlining a label of tiny glyphs THEN the line keeps a visible minimum thickness', () => {
    const tiny: LabelLayout = { ...upright, sizePx: 2 };
    expect(glyphLabelUnderline(tiny, widths, BASELINE_EM)?.thicknessPx).toBeGreaterThanOrEqual(1);
  });

  it('WHEN the layout has no glyphs THEN there is no underline', () => {
    expect(glyphLabelUnderline({ sizePx: SIZE_PX, glyphs: [] }, [], BASELINE_EM)).toBeNull();
  });
});

describe('GIVEN one glyph rotated a quarter turn, reading downwards along a curve', () => {
  // Reading direction +y, so "below the text" is -x in scene coordinates.
  const rotated: LabelLayout = { sizePx: SIZE_PX, glyphs: [{ center: { x: 0, y: 0 }, angle: Math.PI / 2 }] };

  it('WHEN underlined THEN the line follows the glyph rotation and sits on its reading-down side', () => {
    const points = glyphLabelUnderline(rotated, [10], BASELINE_EM)?.points ?? [];
    expect(points.every((point) => point.x < 0)).toBe(true);
  });

  it('WHEN underlined THEN the line runs along the reading direction', () => {
    const points = glyphLabelUnderline(rotated, [10], BASELINE_EM)?.points ?? [];
    expect(points.map((point) => Math.round(point.y))).toEqual([-5, 5]);
  });
});

describe('straightLabelUnderline', () => {
  // GIVEN a 40px wide label centered on (100, 50) whose baseline is 6px below the center
  const underline = straightLabelUnderline({ x: 100, y: 50 }, 40, 6, SIZE_PX);

  it('WHEN underlined THEN the line spans the label width', () => {
    expect(underline.points.map((point) => point.x)).toEqual([80, 120]);
  });

  it('WHEN underlined THEN the line sits below the baseline', () => {
    expect(underline.points.every((point) => point.y > 56)).toBe(true);
  });
});
