import { CubicBezierPath } from './cubicBezierPath';

describe('CubicBezierPath', () => {
  // GIVEN a degenerate cubic whose controls lie on a straight horizontal line of length 90
  const straight = new CubicBezierPath({
    start: { x: 0, y: 0 },
    control1: { x: 10, y: 0 },
    control2: { x: 80, y: 0 },
    end: { x: 90, y: 0 },
  });

  it('WHEN measured THEN its arc length equals the chord', () => {
    expect(straight.length).toBeCloseTo(90, 6);
  });

  it('WHEN sampling at an arc length THEN the point sits exactly that far along (not at the raw parameter)', () => {
    // Uneven control spacing makes parameter t=0.5 land away from x=45; arc-length sampling must not.
    expect(straight.sampleAt(45).point.x).toBeCloseTo(45, 3);
  });

  it('WHEN sampling THEN the tangent is a unit vector in the direction of travel', () => {
    expect(straight.sampleAt(30).tangent).toEqual({ x: 1, y: 0 });
  });

  it('WHEN sampling beyond the ends THEN the sample is clamped to the end points', () => {
    expect([straight.sampleAt(-5).point.x, straight.sampleAt(500).point.x]).toEqual([0, 90]);
  });

  it('WHEN the first control point coincides with the start THEN the start tangent still points along the curve', () => {
    const coincident = new CubicBezierPath({
      start: { x: 0, y: 0 },
      control1: { x: 0, y: 0 },
      control2: { x: 50, y: 0 },
      end: { x: 100, y: 0 },
    });
    expect(coincident.sampleAt(0).tangent.x).toBeCloseTo(1, 6);
  });
});
