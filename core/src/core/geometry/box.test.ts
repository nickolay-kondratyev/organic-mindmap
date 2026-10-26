import { boxesOverlap, inflate, pointInBox, type Box } from './box';

describe('GIVEN a unit box at the origin', () => {
  const box: Box = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

  it('WHEN another box only touches its edge THEN they overlap (a prefilter must keep touching pairs)', () => {
    expect(boxesOverlap(box, { minX: 10, maxX: 20, minY: 0, maxY: 10 })).toBe(true);
  });

  it('WHEN another box is beside it with a gap THEN they do not overlap', () => {
    expect(boxesOverlap(box, { minX: 11, maxX: 20, minY: 0, maxY: 10 })).toBe(false);
  });

  it('WHEN another box is above it with a gap THEN they do not overlap', () => {
    expect(boxesOverlap(box, { minX: 0, maxX: 10, minY: -20, maxY: -1 })).toBe(false);
  });

  it('WHEN inflated by a margin THEN a point just outside the original is inside', () => {
    expect(pointInBox(inflate(box, 2), { x: 11, y: -1 })).toBe(true);
  });

  it('WHEN a point sits on the edge THEN it is inside', () => {
    expect(pointInBox(box, { x: 10, y: 5 })).toBe(true);
  });
});
