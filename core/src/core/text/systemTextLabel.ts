import type { NodeTextFitConfig } from '../config/config';
import type { Point } from '../model/node';
import { paintUnderline, type LabelInk } from './labelPainter';
import { straightLabelUnderline } from './labelUnderline';
import { ELLIPSIS, fitNodeText, type NodeTextMeasure } from './nodeTextFit';

/**
 * How far the alphabetic baseline sits below the `middle` text baseline, in em; about 0.3 for common system fonts
 * (ascent ~0.8, descent ~0.2). Deliberately a constant: close enough for an
 * underline under a fallback label, and no reliance on `TextMetrics` baseline fields.
 */
const BASELINE_BELOW_MIDDLE_EM = 0.3;

/** Width of `text` drawn by the system at `sizePx`; the renderer backs it with `ctx.measureText`. */
export type SystemTextWidth = (text: string, sizePx: number) => number;

/** How a system-font node label is set: the CSS family list (label font first, then system fonts) plus the text style. */
export interface SystemTextStyle {
  readonly family: string;
  readonly sizePx: number;
  readonly letterSpacingEm: number;
}

/** User-perceived characters (grapheme clusters), so a cut never splits an emoji sequence or a combining mark. */
export function graphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (segment) => segment.segment);
}

/** Measures `units` (graphemes) with the system's own text measurement, cutting between graphemes. */
export function systemTextMeasure(units: readonly string[], widthOf: SystemTextWidth): NodeTextMeasure {
  return {
    count: units.length,
    widthPx: (count, sizePx) => widthOf(units.slice(0, count).join(''), sizePx),
    truncatedWidthPx: (count, sizePx) => widthOf(units.slice(0, count).join('') + ELLIPSIS, sizePx),
  };
}

/** The text to draw and its size after the node fit rule (minimum size, then a cut ending in the ellipsis). */
export interface FittedSystemText {
  readonly text: string;
  readonly sizePx: number;
}

export function fitSystemText(text: string, maxWidthPx: number, sizePx: number, limits: NodeTextFitConfig, widthOf: SystemTextWidth): FittedSystemText {
  const units = graphemes(text);
  const fit = fitNodeText(systemTextMeasure(units, widthOf), maxWidthPx, sizePx, limits);
  return { text: fit.truncated ? units.slice(0, fit.keptCount).join('') + ELLIPSIS : text, sizePx: fit.sizePx };
}

/** CSS shorthand for `ctx.font`; synthetic bold becomes the real `bold` weight here. */
export function systemFontCss(style: SystemTextStyle, bold: boolean, sizePx: number): string {
  return `${bold ? 'bold ' : ''}${sizePx}px ${style.family}`;
}

/**
 * Draws a node label with the canvas's own text drawing (`fillText`), so the browser substitutes system fonts for
 * glyphs the label font lacks (color emoji, CJK, Cyrillic). Deliberate exception to spec R17, only for labels the
 * label font cannot cover (see `LoadedFont.coversText`). Known gaps against outline labels: `stretch` and `slant`
 * are not applied, and the text is centered on the em box rather than the cap height.
 */
export function paintSystemTextLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  center: Point,
  maxWidthPx: number,
  style: SystemTextStyle,
  ink: LabelInk,
  limits: NodeTextFitConfig,
): void {
  ctx.save();
  const letterSpacing = (sizePx: number): void => {
    // `letterSpacing` is Chromium/WebKit only; elsewhere the label is drawn without spacing.
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${style.letterSpacingEm * sizePx}px`;
  };
  const widthOf: SystemTextWidth = (sample, sizePx) => {
    ctx.font = systemFontCss(style, ink.bold, sizePx);
    letterSpacing(sizePx);
    return ctx.measureText(sample).width;
  };
  const fitted = fitSystemText(text, maxWidthPx, style.sizePx, limits, widthOf);
  ctx.font = systemFontCss(style, ink.bold, fitted.sizePx);
  letterSpacing(fitted.sizePx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (ink.underline) {
    const widthPx = ctx.measureText(fitted.text).width;
    paintUnderline(ctx, straightLabelUnderline(center, widthPx, BASELINE_BELOW_MIDDLE_EM * fitted.sizePx, fitted.sizePx), ink);
  }
  if (ink.outlineWidthPx > 0) {
    ctx.lineJoin = 'round';
    // The fill covers the inner half of the stroke, so double it to show `outlineWidthPx` outside the glyph.
    ctx.lineWidth = 2 * ink.outlineWidthPx;
    ctx.strokeStyle = ink.outline;
    ctx.strokeText(fitted.text, center.x, center.y);
  }
  ctx.fillStyle = ink.fill;
  ctx.fillText(fitted.text, center.x, center.y);
  ctx.restore();
}
