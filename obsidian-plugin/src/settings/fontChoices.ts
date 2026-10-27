import { DEFAULT_CONFIG, type MindmapConfig } from 'organic-mindmap';

/**
 * The label fonts a person can pick in the settings tab. Every choice is bundled with the plugin
 * (`mapView/bundledFonts.ts` serves the bytes), so a map never fetches from a CDN. All are SIL OFL, Latin subset,
 * weight 400; the licenses sit next to the TTFs under `obsidian-plugin/assets/fonts/`.
 * The config stores the font as a URL (the library's `text.*.url`), so the URLs below are the Fontsource builds
 * the TTFs were vendored from, pinned like the library pins Kalam (`core/src/core/config/config.ts`).
 */
export type FontId = 'kalam' | 'caveat' | 'patrick-hand' | 'nunito';

export interface FontChoice {
  readonly id: FontId;
  /** Shown in the dropdown. */
  readonly name: string;
  readonly url: string;
}

const FONTSOURCE_VERSION = '5.3.0';

function fontsourceUrl(packageName: string): string {
  return `https://cdn.jsdelivr.net/fontsource/fonts/${packageName}@${FONTSOURCE_VERSION}/latin-400-normal.ttf`;
}

export const DEFAULT_FONT_ID: FontId = 'kalam';

export const FONT_CHOICES: readonly FontChoice[] = [
  // The library's default: its URL is the one the default config carries, so a stored default maps back to it.
  { id: DEFAULT_FONT_ID, name: 'Kalam (handwritten)', url: DEFAULT_CONFIG.text.node.url },
  { id: 'caveat', name: 'Caveat (handwritten, loose)', url: fontsourceUrl('caveat') },
  { id: 'patrick-hand', name: 'Patrick Hand (handwritten, neat)', url: fontsourceUrl('patrick-hand') },
  { id: 'nunito', name: 'Nunito (clean sans)', url: fontsourceUrl('nunito') },
];

export function fontChoice(id: FontId): FontChoice {
  const choice = FONT_CHOICES.find((candidate) => candidate.id === id);
  if (choice === undefined) throw new Error(`Unknown font id: id=[${id}]`);
  return choice;
}

/** The bundled font a config URL stands for, or `null` for a URL the plugin does not bundle. */
export function fontIdForUrl(url: string): FontId | null {
  return FONT_CHOICES.find((candidate) => candidate.url === url)?.id ?? null;
}

export function isFontId(value: string): value is FontId {
  return FONT_CHOICES.some((candidate) => candidate.id === value);
}

/**
 * A font URL the plugin does not bundle (a hand-edited `data.json`, or a build that dropped a font) is replaced by
 * the default font, so labels still draw instead of failing to load. Everything else in the config is kept.
 */
export function withBundledFontsOnly(config: MindmapConfig): MindmapConfig {
  const nodeUrl = fontIdForUrl(config.text.node.url) === null ? DEFAULT_CONFIG.text.node.url : config.text.node.url;
  const branchUrl = fontIdForUrl(config.text.branch.url) === null ? DEFAULT_CONFIG.text.branch.url : config.text.branch.url;
  if (nodeUrl === config.text.node.url && branchUrl === config.text.branch.url) return config;
  return {
    ...config,
    text: { ...config.text, node: { ...config.text.node, url: nodeUrl }, branch: { ...config.text.branch, url: branchUrl } },
  };
}
