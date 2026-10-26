import { ellipseShape, type NodeBox } from './nodeShape';

describe('ellipseShape', () => {
  // GIVEN an ellipse 20 wide and 10 tall at the origin
  const box: NodeBox = { center: { x: 0, y: 0 }, size: { width: 20, height: 10 } };

  it('WHEN a point is inside the ellipse but outside the inscribed circle THEN it is contained', () => {
    expect(ellipseShape.contains(box, { x: 8, y: 0 })).toBe(true);
  });

  it('WHEN a point is inside the bounding box but outside the ellipse THEN it is not contained', () => {
    expect(ellipseShape.contains(box, { x: 9, y: 4.5 })).toBe(false);
  });

  it('WHEN asking the rim point to the right THEN it is at half the width', () => {
    expect(ellipseShape.rimPoint(box, { x: 5, y: 0 })).toEqual({ x: 10, y: 0 });
  });

  it('WHEN asking the rim point downward THEN it is at half the height', () => {
    const rim = ellipseShape.rimPoint(box, { x: 0, y: 1 });
    expect([rim.x, rim.y]).toEqual([0, 5]);
  });
});
