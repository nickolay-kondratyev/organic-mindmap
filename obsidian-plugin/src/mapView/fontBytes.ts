import type { FontFetcher } from 'organic-mindmap';

/**
 * A `fontFetcher` that serves bundled bytes by URL and never touches the network: a URL that is not bundled
 * fails plainly (the library then skips that text and warns), instead of silently fetching from a CDN.
 */
export function fontFetcherFromBytes(bytesByUrl: ReadonlyMap<string, Uint8Array>): FontFetcher {
  return async (url) => {
    const bytes = bytesByUrl.get(url);
    if (bytes === undefined) throw new Error(`Font is not bundled with the plugin: url=[${url}]`);
    // A fresh copy per load: the parser gets its own buffer, and a bundled view's offset never leaks.
    return bytes.slice().buffer;
  };
}
