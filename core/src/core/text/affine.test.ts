import { Affine2D, compose } from './affine';

describe('Affine2D', () => {
  it('GIVEN a quarter-turn rotation WHEN applied to +x THEN it maps to +y (y down = clockwise on screen)', () => {
    const p = Affine2D.rotate(Math.PI / 2).apply({ x: 1, y: 0 });
    expect([p.x, p.y].map((v) => Math.round(v))).toEqual([0, 1]);
  });

  it('GIVEN compose(scale, translate) WHEN applied THEN scale runs first', () => {
    const t = compose(Affine2D.scale(2, 2), Affine2D.translate({ x: 10, y: 0 }));
    expect(t.apply({ x: 1, y: 1 })).toEqual({ x: 12, y: 2 });
  });

  it('GIVEN a shear WHEN applied to a point above the baseline THEN x shifts by shear * y', () => {
    expect(Affine2D.shearX(0.5).apply({ x: 0, y: -2 })).toEqual({ x: -1, y: -2 });
  });
});
