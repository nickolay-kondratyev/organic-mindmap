import type { Point } from '../model/node';
import type { LabelLayout } from './labelLayout';

/** Gap between the baseline and the underline's middle, as a fraction of the font size (about where browsers put it). */
const UNDERLINE_GAP_EM = 0.12;
/** Underline thickness as a fraction of the font size; never thinner than `MIN_UNDERLINE_THICKNESS_PX`. */
const UNDERLINE_THICKNESS_EM = 0.07;
/** Keeps the underline visible on small, far-down-the-tree labels. */
const MIN_UNDERLINE_THICKNESS_PX = 1.25;

/** A link label's underline (`MindmapNode.link`): a polyline stroked at `thicknessPx`. */
export interface Underline {
  /** At least two points, in reading order. */
  readonly points: readonly Point[];
  readonly thicknessPx: number;
}

/** Where the underline sits for text at `sizePx`: its distance below the baseline and its thickness. */
function underlineMetrics(sizePx: number): { readonly gapPx: number; readonly thicknessPx: number } {
  return { gapPx: UNDERLINE_GAP_EM * sizePx, thicknessPx: Math.max(MIN_UNDERLINE_THICKNESS_PX, UNDERLINE_THICKNESS_EM * sizePx) };
}

/**
 * Underline of an outline label (node or branch): under each glyph, a segment in that glyph's own rotation, joined
 * glyph to glyph, so on a branch it follows the curve. Points sit `baselineEm` below the glyph centers (the
 * path runs through the visual middle, see `glyphTransform`) plus the underline gap. `null` without glyphs.
 * Known ceiling: one segment per glyph, so a tight curve shows small corners; sample the path instead if that shows.
 */
export function glyphLabelUnderline(layout: LabelLayout, glyphWidthsPx: readonly number[], baselineEm: number): Underline | null {
  if (layout.glyphs.length === 0) return null;
  const { gapPx, thicknessPx } = underlineMetrics(layout.sizePx);
  const belowPx = baselineEm * layout.sizePx + gapPx;
  const points = layout.glyphs.flatMap((glyph, i) => {
    const halfWidth = (glyphWidthsPx[i] ?? 0) / 2;
    return [inGlyphFrame(glyph.center, glyph.angle, -halfWidth, belowPx), inGlyphFrame(glyph.center, glyph.angle, halfWidth, belowPx)];
  });
  return { points, thicknessPx };
}

/**
 * Underline of a straight label centered on `center` (the system-font fallback): `widthPx` wide, `baselinePx` below
 * `center` plus the underline gap.
 */
export function straightLabelUnderline(center: Point, widthPx: number, baselinePx: number, sizePx: number): Underline {
  const { gapPx, thicknessPx } = underlineMetrics(sizePx);
  const y = center.y + baselinePx + gapPx;
  return { points: [{ x: center.x - widthPx / 2, y }, { x: center.x + widthPx / 2, y }], thicknessPx };
}

/** `(along, below)` in a glyph's reading frame (x along the text, y down the glyph), mapped to scene coordinates. */
function inGlyphFrame(center: Point, angle: number, along: number, below: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: center.x + along * cos - below * sin, y: center.y + along * sin + below * cos };
}
