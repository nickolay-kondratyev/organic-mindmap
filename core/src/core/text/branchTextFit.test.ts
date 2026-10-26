import type { BranchTextFitConfig } from '../config/config';
import { fitBranchText } from './branchTextFit';
import { GlyphRun } from './glyphRun';

describe('fitBranchText', () => {
  // GIVEN 10 glyphs of 0.5em at 20px (100px of glyphs) with 0.1em spacing (9 gaps * 2px = 18px)
  const run = new GlyphRun(Array<number>(10).fill(0.5), 1);
  const style = { sizePx: 20, letterSpacingEm: 0.1 };
  const limits: BranchTextFitConfig = { paddingPx: 10, minPaddingPx: 2, minLetterSpacingEm: 0, minFontScale: 0.5 };
  const NOMINAL_SPAN = 118 + 2 * 10;

  it('WHEN the label fits as is THEN nothing changes', () => {
    expect(fitBranchText(run, NOMINAL_SPAN, style, limits)).toEqual({
      sizePx: 20,
      letterSpacingEm: 0.1,
      paddingPx: 10,
      glyphCount: 10,
    });
  });

  it('WHEN the span is generous THEN letter spacing is never loosened', () => {
    expect(fitBranchText(run, 1000, style, limits).letterSpacingEm).toBe(0.1);
  });

  it('WHEN slightly short THEN only letter spacing tightens, padding stays', () => {
    const fit = fitBranchText(run, NOMINAL_SPAN - 9, style, limits);
    expect([fit.letterSpacingEm, fit.paddingPx, fit.sizePx]).toEqual([0.05, 10, 20]);
  });

  it('WHEN spacing at its minimum is not enough THEN padding shrinks', () => {
    // 100px of glyphs at zero spacing; 6px padding per side.
    const fit = fitBranchText(run, 112, style, limits);
    expect([fit.letterSpacingEm, fit.paddingPx, fit.sizePx]).toEqual([0, 6, 20]);
  });

  it('WHEN minimum spacing and padding are not enough THEN the font shrinks', () => {
    // 80px available after 2px padding per side -> 80 / (10 * 0.5em) = 16px.
    const fit = fitBranchText(run, 84, style, limits);
    expect([fit.paddingPx, fit.sizePx, fit.glyphCount]).toEqual([2, 16, 10]);
  });

  it('WHEN even the smallest font overflows THEN trailing glyphs are dropped', () => {
    // Smallest font 10px -> 5px per glyph; 34px available fits 6 glyphs.
    expect(fitBranchText(run, 38, style, limits).glyphCount).toBe(6);
  });

  it('WHEN glyphs are dropped THEN the kept glyphs never pass the span end', () => {
    const fit = fitBranchText(run, 38, style, limits);
    expect(run.widthPx(fit.sizePx, fit.letterSpacingEm, fit.glyphCount) + 2 * fit.paddingPx).toBeLessThanOrEqual(38);
  });

  it('WHEN the span is shorter than the padding THEN no glyph is drawn', () => {
    expect(fitBranchText(run, 3, style, limits).glyphCount).toBe(0);
  });
});
