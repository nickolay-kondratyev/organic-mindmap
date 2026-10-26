import { GlyphRun } from './glyphRun';
import { fitNodeText, glyphRunMeasure, truncatedShapedText, type NodeTextMeasure } from './nodeTextFit';

// Six 1em glyphs -> 60px at 10px; the ellipsis is 1em too.
const RUN = new GlyphRun([1, 1, 1, 1, 1, 1], 1);
const ELLIPSIS_RUN = new GlyphRun([1], 1);
const SIZE_PX = 10;

describe('fitNodeText', () => {
  describe('GIVEN a minimum font scale of 0.5', () => {
    const limits = { minFontScale: 0.5 };
    const measure: NodeTextMeasure = glyphRunMeasure(RUN, ELLIPSIS_RUN, 0);

    it('WHEN the label fits THEN the size is kept and nothing is cut', () => {
      expect(fitNodeText(measure, 100, SIZE_PX, limits)).toEqual({ sizePx: 10, keptCount: 6, truncated: false });
    });

    it('WHEN the label needs shrinking above the minimum THEN only the font shrinks', () => {
      expect(fitNodeText(measure, 45, SIZE_PX, limits)).toEqual({ sizePx: 7.5, keptCount: 6, truncated: false });
    });

    it('WHEN the label does not fit at the minimum size THEN the size stops at the minimum and the text is cut with room for the ellipsis', () => {
      // At 5px each glyph is 5px: 20px fits 3 glyphs + ellipsis.
      expect(fitNodeText(measure, 20, SIZE_PX, limits)).toEqual({ sizePx: 5, keptCount: 3, truncated: true });
    });

    it('WHEN not even one glyph fits with the ellipsis THEN only the ellipsis is kept', () => {
      expect(fitNodeText(measure, 6, SIZE_PX, limits)).toEqual({ sizePx: 5, keptCount: 0, truncated: true });
    });
  });

  describe('GIVEN the default minimum font scale of 0', () => {
    const limits = { minFontScale: 0 };

    it('WHEN the label is far too wide THEN it shrinks without limit and is never cut', () => {
      expect(fitNodeText(glyphRunMeasure(RUN, ELLIPSIS_RUN, 0), 6, SIZE_PX, limits)).toEqual({ sizePx: 1, keptCount: 6, truncated: false });
    });
  });
});

describe('glyphRunMeasure', () => {
  it('GIVEN letter spacing WHEN measuring a cut label THEN the gap before the ellipsis counts', () => {
    // 3 glyphs (30) + 2 gaps (2) + gap before ellipsis (1) + ellipsis (10).
    expect(glyphRunMeasure(RUN, ELLIPSIS_RUN, 0.1).truncatedWidthPx(3, SIZE_PX)).toBeCloseTo(43);
  });
});

describe('truncatedShapedText', () => {
  it('GIVEN a shaped label WHEN truncating to two glyphs THEN the result is those two glyphs plus the ellipsis', () => {
    const shaped = { outlines: [[], [], []], advancesEm: [0.5, 0.6, 0.7] };
    const ellipsis = { outlines: [[]], advancesEm: [1] };
    expect(truncatedShapedText(shaped, ellipsis, 2).advancesEm).toEqual([0.5, 0.6, 1]);
  });
});
