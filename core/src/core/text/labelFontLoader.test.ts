import { DEFAULT_CONFIG, type TextConfig } from '../config/config';
import { vendoredKalamBytes } from '../../../test-support/vendoredKalam';
import type { FontFetcher } from './fontStore';
import { LabelFontLoader, type LabelFontStatus } from './labelFontLoader';

const GOOD_URL = 'https://fonts.test/good.ttf';
const OTHER_GOOD_URL = 'https://fonts.test/other.ttf';
const BAD_URL = 'https://fonts.test/missing.ttf';

const fetcher: FontFetcher = async (url) => {
  if (url === BAD_URL) throw new Error('HTTP 404');
  return vendoredKalamBytes();
};

function textWith(nodeUrl: string, branchUrl: string): TextConfig {
  const text = DEFAULT_CONFIG.text;
  return { ...text, node: { ...text.node, url: nodeUrl }, branch: { ...text.branch, url: branchUrl } };
}

describe('LabelFontLoader', () => {
  // GIVEN a loader recording every published status and repaint request
  let statuses: LabelFontStatus[];
  let repaints: number;
  let loader: LabelFontLoader;
  beforeEach(() => {
    statuses = [];
    repaints = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    loader = new LabelFontLoader(fetcher, {
      onFontsChanged: () => repaints++,
      onStatusChange: (status) => statuses.push(status),
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('WHEN first given a text config THEN loading is published', () => {
    loader.use(textWith(GOOD_URL, GOOD_URL));
    expect(statuses).toEqual([{ node: 'loading', branch: 'loading' }]);
  });

  it('WHEN still loading THEN no font is handed to the renderer', () => {
    loader.use(textWith(GOOD_URL, GOOD_URL));
    expect(loader.fonts()).toEqual({ node: null, branch: null });
  });

  it('WHEN the fonts load THEN loaded is published', async () => {
    loader.use(textWith(GOOD_URL, GOOD_URL));
    await vi.waitFor(() => expect(statuses.at(-1)).toEqual({ node: 'loaded', branch: 'loaded' }));
  });

  it('WHEN the fonts load THEN a repaint is requested', async () => {
    loader.use(textWith(GOOD_URL, GOOD_URL));
    await vi.waitFor(() => expect(repaints).toBeGreaterThan(0));
  });

  it('WHEN only the branch font fails THEN the node font still loads and the branch font reports error', async () => {
    loader.use(textWith(GOOD_URL, BAD_URL));
    await vi.waitFor(() => expect(statuses.at(-1)).toEqual({ node: 'loaded', branch: 'error' }));
  });

  it('WHEN a font fails THEN the renderer gets no font for that text', async () => {
    loader.use(textWith(GOOD_URL, BAD_URL));
    await vi.waitFor(() => expect(loader.status().branch).toBe('error'));
    expect(loader.fonts().branch).toBeNull();
  });

  it('WHEN the config switches to a new font THEN loading is published again', async () => {
    loader.use(textWith(GOOD_URL, GOOD_URL));
    await vi.waitFor(() => expect(loader.status().node).toBe('loaded'));
    loader.use(textWith(OTHER_GOOD_URL, GOOD_URL));
    expect(statuses.at(-1)).toEqual({ node: 'loading', branch: 'loaded' });
  });

  it('WHEN the config switches to a new font THEN that font is handed over once loaded', async () => {
    loader.use(textWith(GOOD_URL, GOOD_URL));
    loader.use(textWith(OTHER_GOOD_URL, GOOD_URL));
    await vi.waitFor(() => expect(loader.fonts().node).not.toBeNull());
  });

  it('WHEN disposed before loads settle THEN nothing more is published', async () => {
    loader.use(textWith(GOOD_URL, GOOD_URL));
    loader.dispose();
    // The fake fetch settles within microtasks; one macrotask turn lets every pending continuation run.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([statuses.length, repaints]).toEqual([1, 0]);
  });
});
