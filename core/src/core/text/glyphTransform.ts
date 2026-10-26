import type { Point } from '../model/node';
import { Affine2D, compose } from './affine';
import type { PlacedGlyph } from './glyphPlacement';
import type { EmOutline } from './loadedFont';

/** Per-label glyph styling that shapes outlines (spec R17). */
export interface GlyphShapeStyle {
  readonly sizePx: number;
  readonly stretch: number;
  readonly slant: number;
  /** Baseline-to-visual-middle distance in em, from the font. */
  readonly verticalCenterEm: number;
}

/**
 * Maps a glyph's em outline (baseline origin, y down) onto the canvas: scale to size, stretch + slant,
 * shift so the middle of its advance and the middle of its height sit on the path (spec R14), then
 * rotate and move to the placed center (spec R12).
 */
export function glyphTransform(placed: PlacedGlyph, glyphWidthPx: number, style: GlyphShapeStyle): Affine2D {
  return compose(
    Affine2D.scale(style.sizePx * style.stretch, style.sizePx),
    // y is down, so a right lean moves points with negative y (above the baseline) to +x.
    Affine2D.shearX(-style.slant),
    Affine2D.translate({ x: -glyphWidthPx / 2, y: style.verticalCenterEm * style.sizePx }),
    Affine2D.rotate(placed.angle),
    Affine2D.translate(placed.center),
  );
}

/** Minimal path sink, satisfied by `CanvasRenderingContext2D`; keeps outline tracing testable. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  closePath(): void;
}

/** Appends a transformed glyph outline to the current path (affine maps keep Bézier curves exact). */
export function traceOutline(sink: PathSink, outline: EmOutline, transform: Affine2D): void {
  const at = (x: number, y: number): Point => transform.apply({ x, y });
  for (const command of outline) {
    switch (command.type) {
      case 'M': {
        const p = at(command.x, command.y);
        sink.moveTo(p.x, p.y);
        break;
      }
      case 'L': {
        const p = at(command.x, command.y);
        sink.lineTo(p.x, p.y);
        break;
      }
      case 'Q': {
        const c = at(command.x1, command.y1);
        const p = at(command.x, command.y);
        sink.quadraticCurveTo(c.x, c.y, p.x, p.y);
        break;
      }
      case 'C': {
        const c1 = at(command.x1, command.y1);
        const c2 = at(command.x2, command.y2);
        const p = at(command.x, command.y);
        sink.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y);
        break;
      }
      case 'Z':
        sink.closePath();
        break;
    }
  }
}
