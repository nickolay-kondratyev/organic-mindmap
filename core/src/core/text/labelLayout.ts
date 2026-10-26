import type { BranchTextFitConfig } from '../config/config';
import { StraightPath, type BranchPath } from '../geometry/branchPath';
import type { Point } from '../model/node';
import { fitBranchText, type BranchTextStyle } from './branchTextFit';
import type { GlyphRun } from './glyphRun';
import { placeGlyphs, readsReversed, type PlacedGlyph } from './glyphPlacement';
import { spanLength, type ArcSpan } from './rimSpan';

/**
 * A laid-out label: `glyphs[i]` is glyph `i` of the run. Dropped overflow glyphs are always trailing, so
 * `glyphs.length` may be shorter than the run.
 */
export interface LabelLayout {
  readonly sizePx: number;
  readonly glyphs: readonly PlacedGlyph[];
}

/** Branch label (spec R12-R15): fitted into the rim-to-rim span, centered in it, flipped when reading left. */
export function layoutBranchLabel(
  path: BranchPath,
  span: ArcSpan,
  run: GlyphRun,
  style: BranchTextStyle,
  limits: BranchTextFitConfig,
): LabelLayout {
  const fit = fitBranchText(run, spanLength(span), style, limits);
  const widthPx = run.widthPx(fit.sizePx, fit.letterSpacingEm, fit.glyphCount);
  const slackPx = (spanLength(span) - widthPx) / 2;
  const reversed = readsReversed(path, span);
  const startArc = reversed ? span.end - slackPx : span.start + slackPx;
  const glyphs = placeGlyphs(
    path,
    { startArc, reversed },
    run.glyphWidthsPx(fit.sizePx, fit.glyphCount),
    fit.letterSpacingEm * fit.sizePx,
  );
  return { sizePx: fit.sizePx, glyphs };
}

/**
 * Straight node label centered on `center` (spec R2) at `style.sizePx`; the caller has already fitted the run
 * (size and cut) with `fitNodeText`.
 */
export function layoutNodeLabel(center: Point, run: GlyphRun, style: BranchTextStyle): LabelLayout {
  const { sizePx } = style;
  const widthPx = run.widthPx(sizePx, style.letterSpacingEm);
  const baseline = new StraightPath({ x: center.x - widthPx / 2, y: center.y }, { x: center.x + widthPx / 2, y: center.y });
  const glyphs = placeGlyphs(baseline, { startArc: 0, reversed: false }, run.glyphWidthsPx(sizePx), style.letterSpacingEm * sizePx);
  return { sizePx, glyphs };
}
