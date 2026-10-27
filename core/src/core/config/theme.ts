/** One palette entry: fill plus a darker outline shade (spec R11). */
export interface PaletteColor {
  readonly fill: string;
  readonly outline: string;
}

export interface RootColor {
  readonly fill: string;
  readonly outline: string;
  readonly text: string;
}

export interface ThemeColorConfig {
  readonly background: string;
  readonly root: RootColor;
  readonly nodeText: string;
  readonly branchText: string;
  /** Glyph outline color for labels with `outlineWidthPx > 0`. */
  readonly textOutline: string;
  /** Label and underline color of link nodes (`MindmapNode.link`). */
  readonly link: string;
  /** Ring around the node the host highlights (`setHighlightedNode`), e.g. the heading the editor cursor is in. */
  readonly highlight: string;
  /** Ordered so neighbouring first-level branches contrast strongly (spec R11). */
  readonly palette: readonly PaletteColor[];
}

export interface ThemeConfig {
  readonly color: ThemeColorConfig;
}

/** Warm, saturated-but-soft hues on a dark green background (spec §8 "Colors"). */
export const DEFAULT_THEME: ThemeConfig = {
  color: {
    background: '#2e423a',
    root: { fill: '#2f3542', outline: '#57606f', text: '#ffffff' },
    nodeText: '#ffffff',
    branchText: '#ffffff',
    textOutline: 'rgba(11, 16, 32, 0.55)',
    // Pale sky blue: reads as "link" next to white labels while staying nearly as light, so it stays legible on
    // every palette fill; the underline carries the cue for anyone who cannot tell the hue.
    link: '#cfe3ff',
    highlight: '#ffffff',
    palette: [
      { fill: '#d4a53a', outline: '#9a7420' }, // goldenrod
      { fill: '#6495ed', outline: '#3f66b3' }, // cornflower blue
      { fill: '#e8795a', outline: '#aa4f36' }, // coral
      { fill: '#8fae7e', outline: '#5f7c50' }, // sage green
      { fill: '#7a6fb0', outline: '#4e4680' }, // slate violet
      { fill: '#c86fa8', outline: '#8f4575' }, // orchid
      { fill: '#9c9a3a', outline: '#6a6922' }, // olive
      { fill: '#3f9f9a', outline: '#276e6a' }, // teal
    ],
  },
};
