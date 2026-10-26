import { fitSystemText, graphemes, systemTextMeasure } from './systemTextLabel';

// Every code point is half the font size wide.
const widthOf = (text: string, sizePx: number): number => [...text].length * sizePx * 0.5;

describe('graphemes', () => {
  it('GIVEN an emoji sequence with a joiner and a variation selector WHEN split THEN it stays one unit', () => {
    expect(graphemes('a\u{1F468}\u200d\u{1F469}\ufe0fb')).toEqual(['a', '\u{1F468}\u200d\u{1F469}\ufe0f', 'b']);
  });
});

describe('systemTextMeasure', () => {
  const measure = systemTextMeasure(['a', 'b', 'c'], widthOf);

  it('WHEN measuring a prefix THEN only those units are measured', () => {
    expect(measure.widthPx(2, 10)).toBe(10);
  });

  it('WHEN measuring a cut prefix THEN the ellipsis is included', () => {
    expect(measure.truncatedWidthPx(2, 10)).toBe(15);
  });
});

describe('fitSystemText', () => {
  // GIVEN a 6-character label at 10px (30px wide) and a minimum font scale of 0.5
  const limits = { minFontScale: 0.5 };

  it('WHEN it fits THEN the text and size are unchanged', () => {
    expect(fitSystemText('abcdef', 40, 10, limits, widthOf)).toEqual({ text: 'abcdef', sizePx: 10 });
  });

  it('WHEN it does not fit at the minimum size THEN it is cut between graphemes and ends with the ellipsis', () => {
    // At 5px each character is 2.5px: 10px fits 3 characters + ellipsis.
    expect(fitSystemText('abcdef', 10, 10, limits, widthOf)).toEqual({ text: 'abc\u2026', sizePx: 5 });
  });
});
