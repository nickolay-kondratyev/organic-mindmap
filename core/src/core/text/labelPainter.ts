import type { LabelLayout } from './labelLayout';
import type { GlyphRun } from './glyphRun';
import { glyphTransform, traceOutline } from './glyphTransform';
import type { LoadedFont, ShapedText } from './loadedFont';

/** How a label is inked: fill, optional outline (spec R16), synthetic bold (spec R3, R17). */
export interface LabelInk {
  readonly fill: string;
  readonly outline: string;
  readonly outlineWidthPx: number;
  readonly bold: boolean;
  readonly stretch: number;
  readonly slant: number;
}

/** Synthetic bold stroke width as a fraction of the font size; thick enough to read as bold, thin enough to keep counters open. */
const BOLD_STROKE_EM = 0.05;

/**
 * Inks a laid-out label from glyph outlines (spec R17: never `fillText`). All glyphs go into one path so
 * outline, bold and fill each paint once and overlapping strokes do not double up.
 */
export function paintLabel(
  ctx: CanvasRenderingContext2D,
  font: LoadedFont,
  shaped: ShapedText,
  run: GlyphRun,
  layout: LabelLayout,
  ink: LabelInk,
): void {
  if (layout.glyphs.length === 0) return;
  const shapeStyle = { sizePx: layout.sizePx, stretch: ink.stretch, slant: ink.slant, verticalCenterEm: font.verticalCenterEm };
  ctx.beginPath();
  layout.glyphs.forEach((placed, i) => {
    const outline = shaped.outlines[i];
    if (outline === undefined) return;
    traceOutline(ctx, outline, glyphTransform(placed, run.glyphWidthPx(i, layout.sizePx), shapeStyle));
  });
  const boldWidthPx = ink.bold ? BOLD_STROKE_EM * layout.sizePx : 0;
  ctx.lineJoin = 'round';
  if (ink.outlineWidthPx > 0) {
    // The fill covers the inner half of the stroke, so double it to show `outlineWidthPx` outside the glyph.
    ctx.lineWidth = 2 * ink.outlineWidthPx + boldWidthPx;
    ctx.strokeStyle = ink.outline;
    ctx.stroke();
  }
  if (boldWidthPx > 0) {
    ctx.lineWidth = boldWidthPx;
    ctx.strokeStyle = ink.fill;
    ctx.stroke();
  }
  ctx.fillStyle = ink.fill;
  ctx.fill();
}
