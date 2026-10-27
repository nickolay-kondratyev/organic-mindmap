import { fontChoice, type FontId } from '../settings/fontChoices';
import { fontFetcherFromBytes } from './fontBytes';
// esbuild inlines the TTFs (`loader: { '.ttf': 'binary' }`, see esbuild.config.mjs). Kalam is the library's own
// vendored copy of the build its default font URLs point at, published under this public subpath
// (core/package.json `exports`; resolved through coreAlias.ts here like the main entry). The other choices are
// vendored by the plugin under `assets/fonts/<name>/` with their SIL OFL license.
// WHY: Obsidian plugins must not fetch from a CDN (offline vaults, privacy, plugin review).
import kalamBytes from 'organic-mindmap/fonts/kalam-latin-400-normal.ttf';
import caveatBytes from '../../assets/fonts/caveat/latin-400-normal.ttf';
import patrickHandBytes from '../../assets/fonts/patrick-hand/latin-400-normal.ttf';
import nunitoBytes from '../../assets/fonts/nunito/latin-400-normal.ttf';

/** Every `FontId` has bytes here: adding a choice without its TTF is a compile error. */
const BYTES_BY_FONT_ID: Readonly<Record<FontId, Uint8Array>> = {
  kalam: kalamBytes,
  caveat: caveatBytes,
  'patrick-hand': patrickHandBytes,
  nunito: nunitoBytes,
};

/** Serves every font the settings tab offers from the bundle; no network request. */
export const bundledFontFetcher = fontFetcherFromBytes(
  new Map((Object.keys(BYTES_BY_FONT_ID) as FontId[]).map((id) => [fontChoice(id).url, BYTES_BY_FONT_ID[id]])),
);
