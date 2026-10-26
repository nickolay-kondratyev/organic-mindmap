import type { NodeTextFitConfig } from '../config/config';
import type { GlyphRun } from './glyphRun';
import type { ShapedText } from './loadedFont';

/** Appended to a node label that is cut (U+2026); fonts lacking it draw their `.notdef` glyph here. */
export const ELLIPSIS = '…';

/** Width of a node label's first `count` units (glyphs or code points), with or without a trailing ellipsis. */
export interface NodeTextMeasure {
  readonly count: number;
  widthPx(count: number, sizePx: number): number;
  /** Width of the first `count` units followed by the ellipsis. */
  truncatedWidthPx(count: number, sizePx: number): number;
}

export interface NodeTextFit {
  readonly sizePx: number;
  /** Units kept; the whole text when not truncated. */
  readonly keptCount: number;
  /** `true` when the kept units are to be followed by the ellipsis. */
  readonly truncated: boolean;
}

/**
 * Fits a node label into `maxWidthPx`: shrinks the font (never grows it) down to `minFontScale * sizePx`; what still
 * does not fit at that size is cut and ends with the ellipsis. `minFontScale` 0 means unlimited shrinking and no cut.
 * Measurement-agnostic so glyph-outline labels and system-font (`fillText`) labels fit by the same rule.
 */
export function fitNodeText(measure: NodeTextMeasure, maxWidthPx: number, sizePx: number, limits: NodeTextFitConfig): NodeTextFit {
  const nominalWidthPx = measure.widthPx(measure.count, sizePx);
  if (nominalWidthPx <= maxWidthPx) return { sizePx, keptCount: measure.count, truncated: false };
  const fitSizePx = (sizePx * maxWidthPx) / nominalWidthPx;
  if (fitSizePx >= sizePx * limits.minFontScale) return { sizePx: fitSizePx, keptCount: measure.count, truncated: false };
  const minSizePx = sizePx * limits.minFontScale;
  // Ceiling: O(n) measurements per label; fine for label-sized strings.
  for (let kept = measure.count - 1; kept > 0; kept--) {
    if (measure.truncatedWidthPx(kept, minSizePx) <= maxWidthPx) return { sizePx: minSizePx, keptCount: kept, truncated: true };
  }
  return { sizePx: minSizePx, keptCount: 0, truncated: true };
}

/** Measures a shaped label by its glyph run; `ellipsis` is the shaped ellipsis in the same font and style. */
export function glyphRunMeasure(run: GlyphRun, ellipsis: GlyphRun, letterSpacingEm: number): NodeTextMeasure {
  return {
    count: run.count,
    widthPx: (count, sizePx) => run.widthPx(sizePx, letterSpacingEm, count),
    truncatedWidthPx: (count, sizePx) =>
      run.widthPx(sizePx, letterSpacingEm, count) + (count > 0 ? letterSpacingEm * sizePx : 0) + ellipsis.widthPx(sizePx, letterSpacingEm),
  };
}

/** The first `keptCount` glyphs of `shaped` followed by the ellipsis glyphs, as one shaped text to lay out and paint. */
export function truncatedShapedText(shaped: ShapedText, ellipsis: ShapedText, keptCount: number): ShapedText {
  return {
    outlines: [...shaped.outlines.slice(0, keptCount), ...ellipsis.outlines],
    advancesEm: [...shaped.advancesEm.slice(0, keptCount), ...ellipsis.advancesEm],
  };
}
