import { glyphTransform, traceOutline, type PathSink } from './glyphTransform';

const UPRIGHT = { sizePx: 20, stretch: 1, slant: 0, verticalCenterEm: 0.25 };

describe('glyphTransform', () => {
  it('GIVEN an unrotated glyph WHEN mapping its baseline origin THEN it lands half an advance left and half a height below the center', () => {
    const t = glyphTransform({ center: { x: 100, y: 50 }, angle: 0 }, 10, UPRIGHT);
    expect(t.apply({ x: 0, y: 0 })).toEqual({ x: 95, y: 55 });
  });

  it('GIVEN a glyph rotated a quarter turn WHEN mapping its baseline origin THEN the offsets rotate with it', () => {
    const p = glyphTransform({ center: { x: 0, y: 0 }, angle: Math.PI / 2 }, 10, UPRIGHT).apply({ x: 0, y: 0 });
    expect([p.x, p.y].map((v) => Math.round(v))).toEqual([-5, -5]);
  });

  it('GIVEN a positive slant WHEN mapping a point above the baseline THEN it leans right', () => {
    const slanted = glyphTransform({ center: { x: 0, y: 0 }, angle: 0 }, 0, { ...UPRIGHT, slant: 0.5 });
    // 1em above the baseline = 20px up; slant 0.5 -> 10px right.
    expect(slanted.apply({ x: 0, y: -1 }).x).toBeCloseTo(10);
  });

  it('GIVEN a stretch WHEN mapping a point on the baseline THEN x scales by the stretch', () => {
    const stretched = glyphTransform({ center: { x: 0, y: 0 }, angle: 0 }, 0, { ...UPRIGHT, stretch: 2 });
    expect(stretched.apply({ x: 1, y: 0 }).x).toBe(40);
  });
});

describe('traceOutline', () => {
  it('GIVEN an outline of every command type WHEN traced THEN each command reaches the sink in order', () => {
    const calls: string[] = [];
    const sink: PathSink = {
      moveTo: () => calls.push('M'),
      lineTo: () => calls.push('L'),
      quadraticCurveTo: () => calls.push('Q'),
      bezierCurveTo: () => calls.push('C'),
      closePath: () => calls.push('Z'),
    };
    const t = glyphTransform({ center: { x: 0, y: 0 }, angle: 0 }, 0, UPRIGHT);
    traceOutline(
      sink,
      [
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 1, y: 0 },
        { type: 'Q', x1: 1, y1: 1, x: 0, y: 1 },
        { type: 'C', x1: 0, y1: 1, x2: 0, y2: 0, x: 0, y: 0 },
        { type: 'Z' },
      ],
      t,
    );
    expect(calls).toEqual(['M', 'L', 'Q', 'C', 'Z']);
  });
});
