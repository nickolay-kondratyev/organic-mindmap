import { DEFAULT_CONFIG } from 'organic-mindmap';
import { fontFetcherFromBytes } from './fontBytes';
// esbuild inlines the TTF (`loader: { '.ttf': 'binary' }`, see esbuild.config.mjs). The library publishes its
// vendored copy of the same Kalam build its default font URLs point at (SIL OFL) under this public subpath
// (core/package.json `exports`; resolved through coreAlias.ts here like the main entry).
// WHY: Obsidian plugins must not fetch from a CDN (offline vaults, privacy, plugin review).
import kalamBytes from 'organic-mindmap/fonts/kalam-latin-400-normal.ttf';

/** Serves the library's default node and branch fonts from the bundle; no network request. */
export const bundledFontFetcher = fontFetcherFromBytes(
  new Map([
    [DEFAULT_CONFIG.text.node.url, kalamBytes],
    [DEFAULT_CONFIG.text.branch.url, kalamBytes],
  ]),
);
