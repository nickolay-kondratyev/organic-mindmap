import { DEFAULT_THEME, type ThemeConfig } from './theme';
import type { NodeSize } from '../model/node';
import { DEFAULT_LAYOUT_CONFIG, type LayoutConfig } from '../layout/layoutConfig';
import { GOLDEN_RATIO } from '../math/goldenRatio';

/** Depth-based node sizing (spec R4): `rootSize * depthScale^depth`, never below `minScale * rootSize`. */
export interface NodeSizeConfig {
  readonly rootSize: NodeSize;
  readonly depthScale: number;
  readonly minScale: number;
}

/** Branch thickness knobs (spec R5); consumed by the branch renderer. */
export interface BranchConfig {
  /** Width where a root branch leaves the root, in px. */
  readonly rootWidth: number;
  /** Multiplier applied per tree level to the starting width. */
  readonly widthPerLevel: number;
  /** End width as a fraction of the start width (0 = needle point). */
  readonly taper: number;
  /** How much one edge bulges relative to the other, as a fraction of the half width (spec R7; 0 = symmetric). */
  readonly asymmetry: number;
}

/** Font plus glyph-outline styling for one kind of label (spec R17, R18); node and branch text are independent. */
export interface FontConfig {
  /**
   * TTF URL the host supplies; parsed with opentype.js by the text module. To supply bytes instead, pass a
   * `fontFetcher` at mount (or use a `blob:`/`data:` URL).
   */
  readonly url: string;
  readonly sizePx: number;
  /** Extra space between glyphs, as a fraction of the font size (negative tightens). */
  readonly letterSpacingEm: number;
  /** Horizontal glyph scale; 1 = as designed. */
  readonly stretch: number;
  /** Horizontal shear of glyphs (tangent of the lean angle); 0 = upright, positive leans right. */
  readonly slant: number;
  /** Synthetic bold (outline thickened by a stroke); the root label is always bold (spec R3). */
  readonly bold: boolean;
  /** Outline drawn around glyphs in `theme.color.textOutline`; 0 = no outline (spec R16). */
  readonly outlineWidthPx: number;
}

/** Fitting cascade for branch labels that do not fit between the two node rims (spec R15). */
export interface BranchTextFitConfig {
  /** Free space kept at each end of the rim-to-rim span. */
  readonly paddingPx: number;
  /** Step 2 of the cascade shrinks padding down to this. */
  readonly minPaddingPx: number;
  /** Step 1 of the cascade tightens letter spacing down to this. */
  readonly minLetterSpacingEm: number;
  /** Step 3 of the cascade shrinks the font down to this fraction of `sizePx`; glyphs that still overflow are dropped. */
  readonly minFontScale: number;
}

/** Fitting rule for node labels wider than their node. */
export interface NodeTextFitConfig {
  /**
   * The label shrinks down to this fraction of `sizePx`, then is cut and ends with "…". 0 (the default) shrinks
   * without limit and never cuts.
   */
  readonly minFontScale: number;
}

export interface TextConfig {
  readonly node: FontConfig;
  readonly branch: FontConfig;
  readonly branchFit: BranchTextFitConfig;
  readonly nodeFit: NodeTextFitConfig;
}

/**
 * How the map behaves under the user's hands (spec I1-I5). The `allow*` switches turn off the map's own edit
 * controls; all three off gives a move-only map (dragging onto a node still moves it). Requests the host sends
 * itself (`requestEdit`) are never gated by them.
 */
export interface InteractionConfig {
  /** Ask before a node dropped onto another node becomes its child (spec I3); the dialog's "Don't ask again" turns it off. */
  readonly confirmReparent: boolean;
  /** The hover "+" that adds a child (spec I4). */
  readonly allowAdd: boolean;
  /** Double-click opens the inline rename editor (spec I4). */
  readonly allowRename: boolean;
  /** Reserved: the map has no delete control today (hosts send `delete` from their own UI), so this has no effect yet. */
  readonly allowDelete: boolean;
}

/**
 * Every visual and behavioral parameter of the library. All fields are plain, serializable data so a settings
 * panel can be generated from the shape. Code-level extension points (stages, shapes, strategies) live in
 * `MindmapExtensions`, not here.
 */
export interface MindmapConfig {
  readonly theme: ThemeConfig;
  readonly node: NodeSizeConfig;
  readonly branch: BranchConfig;
  readonly text: TextConfig;
  readonly layout: LayoutConfig;
  readonly interaction: InteractionConfig;
}

/** Recursive partial for plain-data config objects; arrays are treated as leaves (replaced, not merged). */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type PartialMindmapConfig = DeepPartial<MindmapConfig>;

// Pinned (not @latest) so the default look cannot drift; `assets/fonts/kalam/` vendors the same file for tests.
const KALAM_TTF_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/kalam@5.3.0/latin-400-normal.ttf';

const DEFAULT_FONT: FontConfig = {
  url: KALAM_TTF_URL,
  sizePx: 18,
  letterSpacingEm: 0,
  stretch: 1,
  slant: 0,
  bold: false,
  outlineWidthPx: 0,
};

export const DEFAULT_CONFIG: MindmapConfig = {
  theme: DEFAULT_THEME,
  node: {
    rootSize: { width: 180, height: 64 },
    depthScale: 1 / GOLDEN_RATIO ** 0.5,
    minScale: 0.45,
  },
  branch: {
    rootWidth: 60,
    widthPerLevel: 1 / GOLDEN_RATIO,
    taper: 0.15,
    asymmetry: 0.2,
  },
  text: {
    node: DEFAULT_FONT,
    // A thin dark outline keeps white branch text legible on light limb colors (spec §8 "Text").
    branch: { ...DEFAULT_FONT, outlineWidthPx: 1.5 },
    branchFit: { paddingPx: 8, minPaddingPx: 2, minLetterSpacingEm: -0.05, minFontScale: 0.6 },
    nodeFit: { minFontScale: 0 },
  },
  layout: DEFAULT_LAYOUT_CONFIG,
  interaction: { confirmReparent: true, allowAdd: true, allowRename: true, allowDelete: true },
};

/** Merges a partial user config over the defaults (deep for objects, replace for arrays and primitives). */
export function resolveConfig(partial: PartialMindmapConfig | undefined): MindmapConfig {
  return partial === undefined ? DEFAULT_CONFIG : deepMerge<MindmapConfig>(DEFAULT_CONFIG, partial);
}

function deepMerge<T>(base: T, override: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    result[key] = deepMerge((base as Record<string, unknown>)[key], value as never);
  }
  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
