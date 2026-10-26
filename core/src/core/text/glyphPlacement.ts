import type { BranchPath } from '../geometry/branchPath';
import type { Point } from '../model/node';
import type { ArcSpan } from './rimSpan';

/** Where one glyph goes: the middle of its advance sits on the path, rotated to the reading direction. */
export interface PlacedGlyph {
  readonly center: Point;
  /** Radians; 0 = reading along +x. */
  readonly angle: number;
}

/** Where a line of glyphs starts along a path and which way it reads. */
export interface GlyphLine {
  /** Arc length of the first glyph's leading edge. */
  readonly startArc: number;
  /** `true` when reading runs against the path direction (towards smaller arc lengths). */
  readonly reversed: boolean;
}

/**
 * Text reads backwards along a path whose direction points left; flip it so it reads left->right, upright
 * (spec R13). Decided from the actual geometry at the span middle rather than the node's `side`, so a
 * dragged node whose branch crosses over still reads upright.
 */
export function readsReversed(path: BranchPath, span: ArcSpan): boolean {
  return path.sampleAt((span.start + span.end) / 2).tangent.x < 0;
}

/** Places glyphs one by one along the path, each rotated to the local tangent (spec R12). */
export function placeGlyphs(
  path: BranchPath,
  line: GlyphLine,
  glyphWidthsPx: readonly number[],
  gapPx: number,
): PlacedGlyph[] {
  const direction = line.reversed ? -1 : 1;
  const flip = line.reversed ? Math.PI : 0;
  const placed: PlacedGlyph[] = [];
  let cursor = 0;
  for (const width of glyphWidthsPx) {
    const sample = path.sampleAt(line.startArc + direction * (cursor + width / 2));
    placed.push({ center: sample.point, angle: Math.atan2(sample.tangent.y, sample.tangent.x) + flip });
    cursor += width + gapPx;
  }
  return placed;
}
