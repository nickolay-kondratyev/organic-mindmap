import { GlyphRun } from './glyphRun';

describe('GlyphRun', () => {
  // GIVEN three glyphs of 0.5em each, unstretched
  const run = new GlyphRun([0.5, 0.5, 0.5], 1);

  it('WHEN measuring with letter spacing THEN spacing is added only between glyphs', () => {
    expect(run.widthPx(10, 0.1)).toBeCloseTo(15 + 2);
  });

  it('WHEN measuring a prefix THEN only those glyphs count', () => {
    expect(run.widthPx(10, 0, 2)).toBe(10);
  });

  it('WHEN stretched THEN glyph widths scale but spacing does not', () => {
    expect(new GlyphRun([0.5, 0.5], 2).widthPx(10, 0.1)).toBeCloseTo(20 + 1);
  });
});
