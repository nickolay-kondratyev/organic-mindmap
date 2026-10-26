import type { Point } from '../model/node';

/**
 * 2D affine transform `[a c e; b d f; 0 0 1]` (same layout as `CanvasRenderingContext2D.setTransform`).
 * Glyph outlines are transformed point by point instead of via `ctx.transform`, so outline and bold
 * stroke widths stay uniform regardless of stretch/slant/size (spec R17).
 */
export class Affine2D {
  static readonly IDENTITY = new Affine2D(1, 0, 0, 1, 0, 0);

  constructor(
    readonly a: number,
    readonly b: number,
    readonly c: number,
    readonly d: number,
    readonly e: number,
    readonly f: number,
  ) {}

  static translate(offset: Point): Affine2D {
    return new Affine2D(1, 0, 0, 1, offset.x, offset.y);
  }

  static rotate(radians: number): Affine2D {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Affine2D(cos, sin, -sin, cos, 0, 0);
  }

  static scale(sx: number, sy: number): Affine2D {
    return new Affine2D(sx, 0, 0, sy, 0, 0);
  }

  /** `x' = x + shearX * y`. */
  static shearX(shearX: number): Affine2D {
    return new Affine2D(1, 0, shearX, 1, 0, 0);
  }

  /** `this ∘ inner`: applies `inner` first, then `this`. */
  then(inner: Affine2D): Affine2D {
    return new Affine2D(
      this.a * inner.a + this.c * inner.b,
      this.b * inner.a + this.d * inner.b,
      this.a * inner.c + this.c * inner.d,
      this.b * inner.c + this.d * inner.d,
      this.a * inner.e + this.c * inner.f + this.e,
      this.b * inner.e + this.d * inner.f + this.f,
    );
  }

  apply(point: Point): Point {
    return { x: this.a * point.x + this.c * point.y + this.e, y: this.b * point.x + this.d * point.y + this.f };
  }
}

/** Composes left to right in application order: `compose(first, second, third)` applies `first` first. */
export function compose(...transforms: readonly Affine2D[]): Affine2D {
  return transforms.reduce((acc, next) => next.then(acc), Affine2D.IDENTITY);
}
