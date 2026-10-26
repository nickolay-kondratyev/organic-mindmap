import { StraightPath } from './branchPath';

describe('StraightPath', () => {
  // GIVEN a horizontal segment of length 10
  const path = new StraightPath({ x: 0, y: 0 }, { x: 10, y: 0 });

  it('WHEN sampling at half length THEN the point is the midpoint with a unit tangent along x', () => {
    expect(path.sampleAt(5)).toEqual({ point: { x: 5, y: 0 }, tangent: { x: 1, y: 0 } });
  });

  it('WHEN sampling past the end THEN the sample is clamped to the end point', () => {
    expect(path.sampleAt(99).point).toEqual({ x: 10, y: 0 });
  });
});
