import { vendoredKalamBytes } from '../../../test-support/vendoredKalam';
import { CssFontFaces } from './cssFontFaces';
import { LoadedFont } from './loadedFont';

/** Stands in for the browser's `FontFace`: `load()` settles only when the test says so. */
class FakeFontFace {
  private static pending: (() => void)[] = [];
  constructor(
    readonly family: string,
    readonly bytes: ArrayBuffer,
  ) {}
  load(): Promise<void> {
    return new Promise((resolve) => FakeFontFace.pending.push(resolve));
  }
  static async settleAll(): Promise<void> {
    for (const resolve of FakeFontFace.pending.splice(0)) resolve();
    await Promise.resolve();
  }
}

function fakeDocument(): Document {
  const faces = new Set<unknown>();
  return { fonts: { add: (face: unknown) => faces.add(face), delete: (face: unknown) => faces.delete(face) } } as unknown as Document;
}

describe('GIVEN a label font registered as a CSS font face', () => {
  const font = LoadedFont.parse(vendoredKalamBytes());
  let onFontReady: ReturnType<typeof vi.fn<() => void>>;
  let faces: CssFontFaces;

  beforeEach(() => {
    vi.stubGlobal('FontFace', FakeFontFace);
    onFontReady = vi.fn<() => void>();
    faces = new CssFontFaces(fakeDocument(), onFontReady);
    faces.familyFor(font);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('WHEN the face finishes loading THEN the owner is told so it can repaint', async () => {
    await FakeFontFace.settleAll();
    expect(onFontReady).toHaveBeenCalledTimes(1);
  });

  it('WHEN the face finishes loading after dispose THEN the owner is not told', async () => {
    faces.dispose();
    await FakeFontFace.settleAll();
    expect(onFontReady).not.toHaveBeenCalled();
  });

  it('WHEN asking the family twice for the same font THEN the face is registered once', () => {
    expect(faces.familyFor(font)).toBe('"organic-mindmap-font-1", cursive');
  });
});
