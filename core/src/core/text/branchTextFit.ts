import type { BranchTextFitConfig } from '../config/config';
import type { GlyphRun } from './glyphRun';

/** Nominal style the cascade starts from. */
export interface BranchTextStyle {
  readonly sizePx: number;
  readonly letterSpacingEm: number;
}

/** Outcome of the fitting cascade; `glyphCount < run.count` means trailing glyphs were dropped. */
export interface BranchTextFit {
  readonly sizePx: number;
  readonly letterSpacingEm: number;
  readonly paddingPx: number;
  readonly glyphCount: number;
}

/**
 * Fits a label into a span of `spanLengthPx` (spec R15). Each step only runs when the previous one was
 * not enough: (1) tighten letter spacing, (2) shrink padding, (3) shrink the font, (4) drop trailing
 * glyphs that still overflow. Never loosens anything that already fits.
 */
export function fitBranchText(
  run: GlyphRun,
  spanLengthPx: number,
  style: BranchTextStyle,
  limits: BranchTextFitConfig,
): BranchTextFit {
  const nominal: BranchTextFit = {
    sizePx: style.sizePx,
    letterSpacingEm: style.letterSpacingEm,
    paddingPx: limits.paddingPx,
    glyphCount: run.count,
  };
  if (fits(run, spanLengthPx, nominal)) return nominal;

  const tighter = { ...nominal, letterSpacingEm: tightestSpacingThatFits(run, spanLengthPx, nominal, limits) };
  if (fits(run, spanLengthPx, tighter)) return tighter;

  const lessPadding = { ...tighter, paddingPx: smallestPaddingThatFits(run, spanLengthPx, tighter, limits) };
  if (fits(run, spanLengthPx, lessPadding)) return lessPadding;

  const smaller = { ...lessPadding, sizePx: largestSizeThatFits(run, spanLengthPx, lessPadding, style, limits) };
  if (fits(run, spanLengthPx, smaller)) return smaller;

  return { ...smaller, glyphCount: glyphsThatFit(run, spanLengthPx, smaller) };
}

function availablePx(spanLengthPx: number, paddingPx: number): number {
  return spanLengthPx - 2 * paddingPx;
}

function fits(run: GlyphRun, spanLengthPx: number, fit: BranchTextFit): boolean {
  return run.widthPx(fit.sizePx, fit.letterSpacingEm, fit.glyphCount) <= availablePx(spanLengthPx, fit.paddingPx);
}

function tightestSpacingThatFits(
  run: GlyphRun,
  spanLengthPx: number,
  fit: BranchTextFit,
  limits: BranchTextFitConfig,
): number {
  const gaps = run.count - 1;
  if (gaps <= 0) return fit.letterSpacingEm;
  const glyphsOnlyPx = run.widthPx(fit.sizePx, 0);
  const needed = (availablePx(spanLengthPx, fit.paddingPx) - glyphsOnlyPx) / (gaps * fit.sizePx);
  return Math.min(fit.letterSpacingEm, Math.max(limits.minLetterSpacingEm, needed));
}

function smallestPaddingThatFits(
  run: GlyphRun,
  spanLengthPx: number,
  fit: BranchTextFit,
  limits: BranchTextFitConfig,
): number {
  const needed = (spanLengthPx - run.widthPx(fit.sizePx, fit.letterSpacingEm)) / 2;
  return Math.min(fit.paddingPx, Math.max(limits.minPaddingPx, needed));
}

function largestSizeThatFits(
  run: GlyphRun,
  spanLengthPx: number,
  fit: BranchTextFit,
  style: BranchTextStyle,
  limits: BranchTextFitConfig,
): number {
  const minSizePx = style.sizePx * limits.minFontScale;
  // Width is linear in size (spacing is em-based), so the fitting size is a single division.
  const widthPerPx = run.widthPx(1, fit.letterSpacingEm);
  if (widthPerPx <= 0) return fit.sizePx;
  const needed = availablePx(spanLengthPx, fit.paddingPx) / widthPerPx;
  return Math.min(fit.sizePx, Math.max(minSizePx, needed));
}

function glyphsThatFit(run: GlyphRun, spanLengthPx: number, fit: BranchTextFit): number {
  const available = availablePx(spanLengthPx, fit.paddingPx);
  let count = run.count;
  while (count > 0 && run.widthPx(fit.sizePx, fit.letterSpacingEm, count) > available) count--;
  return count;
}
