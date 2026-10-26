/**
 * A shaped label reduced to what fitting and placement need: per-glyph advances in em (kerning to the
 * next glyph included) plus the horizontal stretch. Pure, so fitting is testable without a font.
 */
export class GlyphRun {
  constructor(
    readonly advancesEm: readonly number[],
    readonly stretch: number,
  ) {}

  get count(): number {
    return this.advancesEm.length;
  }

  glyphWidthPx(index: number, sizePx: number): number {
    return (this.advancesEm[index] ?? 0) * this.stretch * sizePx;
  }

  /** Width of the first `count` glyphs; letter spacing only goes between glyphs, not after the last. */
  widthPx(sizePx: number, letterSpacingEm: number, count: number = this.count): number {
    if (count <= 0) return 0;
    let advanceEm = 0;
    for (let i = 0; i < count; i++) advanceEm += this.advancesEm[i] ?? 0;
    return sizePx * (advanceEm * this.stretch + letterSpacingEm * (count - 1));
  }

  glyphWidthsPx(sizePx: number, count: number = this.count): number[] {
    return Array.from({ length: count }, (_, i) => this.glyphWidthPx(i, sizePx));
  }
}
