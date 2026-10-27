import { DEFAULT_CONFIG } from 'organic-mindmap';
import { FONT_CHOICES, fontChoice, fontIdForUrl, withBundledFontsOnly } from './fontChoices';

describe('font choices', () => {
  it("GIVEN the library's default font URL THEN it is the Kalam choice", () => {
    expect(fontIdForUrl(DEFAULT_CONFIG.text.node.url)).toBe('kalam');
  });

  it('GIVEN a URL the plugin does not bundle THEN it maps to no choice', () => {
    expect(fontIdForUrl('https://cdn.example/other.ttf')).toBeNull();
  });

  it('GIVEN every choice THEN its URL maps back to its id (dropdown round trip)', () => {
    expect(FONT_CHOICES.map((choice) => fontIdForUrl(choice.url))).toEqual(FONT_CHOICES.map((choice) => choice.id));
  });

  it('GIVEN a pinned Fontsource build THEN every URL names a Latin 400 TTF of a pinned version (no @latest drift)', () => {
    for (const choice of FONT_CHOICES) {
      expect(choice.url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/[a-z-]+@\d+\.\d+\.\d+\/latin-400-normal\.ttf$/);
    }
  });
});

describe('withBundledFontsOnly', () => {
  it('GIVEN a config whose node font is not bundled THEN the node font falls back to the default and the branch font is kept', () => {
    const stored = {
      ...DEFAULT_CONFIG,
      text: {
        ...DEFAULT_CONFIG.text,
        node: { ...DEFAULT_CONFIG.text.node, url: 'https://cdn.example/vanished.ttf' },
        branch: { ...DEFAULT_CONFIG.text.branch, url: fontChoice('nunito').url },
      },
    };
    const config = withBundledFontsOnly(stored);
    expect({ node: config.text.node.url, branch: config.text.branch.url }).toEqual({
      node: DEFAULT_CONFIG.text.node.url,
      branch: fontChoice('nunito').url,
    });
  });

  it('GIVEN a config with only bundled fonts THEN it is returned as is', () => {
    expect(withBundledFontsOnly(DEFAULT_CONFIG)).toBe(DEFAULT_CONFIG);
  });

  it('GIVEN an unbundled font THEN the other font settings (size, outline) survive the fallback', () => {
    const stored = {
      ...DEFAULT_CONFIG,
      text: { ...DEFAULT_CONFIG.text, branch: { ...DEFAULT_CONFIG.text.branch, url: 'https://cdn.example/gone.ttf', sizePx: 31 } },
    };
    expect(withBundledFontsOnly(stored).text.branch.sizePx).toBe(31);
  });
});
