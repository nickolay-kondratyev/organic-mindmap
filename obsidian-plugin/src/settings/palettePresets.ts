import { DEFAULT_THEME, type PaletteColor } from 'organic-mindmap';

/**
 * Named branch palettes for the settings dropdown, over the library's `theme.color.palette`. Every preset has the
 * default palette's length (the library restores stored palettes only at that length) and every fill clears
 * `MIN_WHITE_TEXT_CONTRAST` against white label text (`palettePresets.test.ts`), the bar the default palette sets.
 * Outlines are the fill darkened to ~70%, like the default's. Ordered so neighbouring first-level branches contrast.
 * WHY no pastel preset: pale fills under white labels fail the legibility bar; a pastel look needs dark label text
 * too, which is a theme change, not a palette swap.
 */
export type PaletteId = 'warm' | 'vivid' | 'muted' | 'monochrome';

export interface PalettePreset {
  readonly id: PaletteId;
  /** Shown in the dropdown. */
  readonly name: string;
  readonly palette: readonly PaletteColor[];
}

/**
 * WCAG contrast ratio of white text over a fill; 2.2 is what the default palette's lightest fill (goldenrod) clears.
 * Below AA for normal text on purpose: node labels are large and branch labels carry a dark outline (spec §8).
 */
export const MIN_WHITE_TEXT_CONTRAST = 2.2;

export const DEFAULT_PALETTE_ID: PaletteId = 'warm';

export const PALETTE_PRESETS: readonly PalettePreset[] = [
  { id: DEFAULT_PALETTE_ID, name: 'Warm (default)', palette: DEFAULT_THEME.color.palette },
  {
    id: 'vivid',
    name: 'Vivid',
    palette: [
      { fill: '#e63946', outline: '#a12831' }, // red
      { fill: '#1d7fe6', outline: '#1459a1' }, // blue
      { fill: '#e08a00', outline: '#9d6100' }, // orange
      { fill: '#2a9d4a', outline: '#1d6e34' }, // green
      { fill: '#7b3fe4', outline: '#562ca0' }, // violet
      { fill: '#d6338f', outline: '#962464' }, // magenta
      { fill: '#0f9ba8', outline: '#0a6c76' }, // teal
      { fill: '#6b7f1a', outline: '#4b5912' }, // olive
    ],
  },
  {
    id: 'muted',
    name: 'Muted',
    palette: [
      { fill: '#b08a52', outline: '#7b6139' }, // ochre
      { fill: '#6c86a6', outline: '#4c5e74' }, // steel blue
      { fill: '#b57568', outline: '#7f5249' }, // clay
      { fill: '#7f9470', outline: '#59684e' }, // moss
      { fill: '#7d7496', outline: '#585169' }, // dusk violet
      { fill: '#a3758f', outline: '#725264' }, // mauve
      { fill: '#8e8a5c', outline: '#636140' }, // khaki
      { fill: '#5f8f8c', outline: '#426462' }, // sea
    ],
  },
  {
    id: 'monochrome',
    name: 'Monochrome (slate)',
    palette: [
      { fill: '#5b6b85', outline: '#404b5d' },
      { fill: '#7d8aa3', outline: '#586172' },
      { fill: '#4a5872', outline: '#343e50' },
      { fill: '#6e7b96', outline: '#4d5669' },
      { fill: '#54627c', outline: '#3b4557' },
      { fill: '#8290a9', outline: '#5b6576' },
      { fill: '#434f66', outline: '#2f3747' },
      { fill: '#66748f', outline: '#475164' },
    ],
  },
];

export function palettePreset(id: PaletteId): PalettePreset {
  const preset = PALETTE_PRESETS.find((candidate) => candidate.id === id);
  if (preset === undefined) throw new Error(`Unknown palette preset: id=[${id}]`);
  return preset;
}

export function isPaletteId(value: string): value is PaletteId {
  return PALETTE_PRESETS.some((candidate) => candidate.id === value);
}

/** The preset a palette is, or `null` for a palette matching none (e.g. hand-edited `data.json`): shown as "Custom". */
export function presetIdForPalette(palette: readonly PaletteColor[]): PaletteId | null {
  return PALETTE_PRESETS.find((candidate) => samePalette(candidate.palette, palette))?.id ?? null;
}

function samePalette(a: readonly PaletteColor[], b: readonly PaletteColor[]): boolean {
  return a.length === b.length && a.every((color, index) => color.fill === b[index]?.fill && color.outline === b[index]?.outline);
}

/** WCAG 2 contrast ratio of white over an opaque `#rrggbb` fill. */
export function whiteTextContrast(fillHex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(fillHex);
  if (match === null) throw new Error(`Not a #rrggbb color: fill=[${fillHex}]`);
  const [red, green, blue] = [match[1], match[2], match[3]].map((hex) => linearChannel(parseInt(hex ?? '00', 16) / 255));
  const luminance = 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
  const WHITE_LUMINANCE = 1;
  const AMBIENT = 0.05;
  return (WHITE_LUMINANCE + AMBIENT) / (luminance + AMBIENT);
}

function linearChannel(srgb: number): number {
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}
