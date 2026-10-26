import { LoadedFont } from './loadedFont';

/** Observable font state (spec L6). */
export type FontStatus = 'loading' | 'loaded' | 'error';

export type FontEntry =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly font: LoadedFont }
  | { readonly status: 'error'; readonly error: unknown };

/** I/O seam: turns a font URL into TTF bytes. Hosts that already hold bytes can supply their own. */
export type FontFetcher = (url: string) => Promise<ArrayBuffer>;

export class FontFetchError extends Error {}

export const fetchFontBytes: FontFetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new FontFetchError(`Font request failed with HTTP ${response.status} for [${url}]`);
  return response.arrayBuffer();
};

/**
 * Loads each font URL once and remembers the outcome. A failed load stays `error` (the renderer simply
 * skips that text) instead of throwing into rendering. Ceiling: no retry; an upgrade would re-request a
 * failed URL when the host sets it again.
 */
export class FontStore {
  private readonly entries = new Map<string, FontEntry>();

  constructor(
    private readonly fetcher: FontFetcher,
    /** Called after any load settles (loaded or error), e.g. to repaint and publish the new status. */
    private readonly onSettled: () => void,
  ) {}

  /** Current entry for `url`, starting the load on first use (idempotent). */
  load(url: string): FontEntry {
    const existing = this.entries.get(url);
    if (existing !== undefined) return existing;
    const loading: FontEntry = { status: 'loading' };
    this.entries.set(url, loading);
    void this.fetchAndParse(url);
    return loading;
  }

  private async fetchAndParse(url: string): Promise<void> {
    try {
      const font = LoadedFont.parse(await this.fetcher(url));
      this.entries.set(url, { status: 'loaded', font });
    } catch (error) {
      // Status `error` tells the host *that* it failed; the warning tells a developer *why*.
      console.warn('organic-mindmap: font failed to load; its text is not drawn', { url, error });
      this.entries.set(url, { status: 'error', error });
    }
    this.onSettled();
  }
}
