import type { LoadedFont } from './loadedFont';

/** Used while the label font is still loading (or failed), so typing is never blocked on it. */
const FALLBACK_FAMILY = 'cursive';
const FAMILY_PREFIX = 'organic-mindmap-font-';

/**
 * Registers parsed label fonts with the document (`FontFace` from the very same bytes), so DOM text such as the
 * inline rename input (spec I4) and system-font fallback labels on the canvas show the real font where it has the
 * glyph. Each font is registered once.
 */
export class CssFontFaces {
  private readonly families = new WeakMap<LoadedFont, string>();
  private readonly faces: FontFace[] = [];
  private registered = 0;
  private disposed = false;

  constructor(
    private readonly document: Document,
    /** A registered face became usable: canvas text drawn before this used the fallback family, so repaint. */
    private readonly onFontReady: () => void = () => {},
  ) {}

  /** CSS `font-family` value for `font`; the fallback alone when no font is loaded. */
  familyFor(font: LoadedFont | null): string {
    if (font === null) return FALLBACK_FAMILY;
    return `"${this.register(font)}", ${FALLBACK_FAMILY}`;
  }

  /**
   * Unregisters every face this instance added, so remounting does not pile them up on the document, and stops
   * `onFontReady`: a load still settling must not repaint a destroyed mount.
   */
  dispose(): void {
    this.disposed = true;
    for (const face of this.faces) this.document.fonts.delete(face);
    this.faces.length = 0;
  }

  private register(font: LoadedFont): string {
    const existing = this.families.get(font);
    if (existing !== undefined) return existing;
    this.registered += 1;
    const family = `${FAMILY_PREFIX}${this.registered}`;
    const face = new FontFace(family, font.bytes);
    this.document.fonts.add(face);
    this.faces.push(face);
    // Bytes are local, so this settles almost at once; a font the browser cannot use just leaves the fallback.
    face
      .load()
      .then(() => {
        if (!this.disposed) this.onFontReady();
      })
      .catch((error: unknown) => console.warn('organic-mindmap: label font unusable for DOM text', { error }));
    this.families.set(font, family);
    return family;
  }
}
