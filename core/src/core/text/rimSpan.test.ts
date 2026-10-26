import { StraightPath } from '../geometry/branchPath';
import { ellipseShape } from '../shape/nodeShape';
import { rimToRimSpan } from './rimSpan';

describe('rimToRimSpan', () => {
  // GIVEN a parent 100px wide at x=0 and a child 40px wide at x=200, joined center to center
  const parent = { center: { x: 0, y: 0 }, size: { width: 100, height: 40 } };
  const child = { center: { x: 200, y: 0 }, size: { width: 40, height: 20 } };
  const path = new StraightPath(parent.center, child.center);
  const span = rimToRimSpan(path, parent, child, ellipseShape);

  it('WHEN measured THEN the span starts at the parent rim', () => {
    expect(span.start).toBeCloseTo(50, 3);
  });

  it('WHEN measured THEN the span ends at the child rim', () => {
    expect(span.end).toBeCloseTo(180, 3);
  });

  it('WHEN the nodes overlap THEN the span is empty', () => {
    const overlapping = { ...child, center: { x: 30, y: 0 } };
    const empty = rimToRimSpan(new StraightPath(parent.center, overlapping.center), parent, overlapping, ellipseShape);
    expect(empty.end - empty.start).toBe(0);
  });
});

describe('rimToRimSpan with a child that swallows its parent', () => {
  it('GIVEN a child large enough to contain the parent center WHEN measured THEN the span is empty, never negative', () => {
    const parent = { center: { x: 0, y: 0 }, size: { width: 40, height: 20 } };
    const child = { center: { x: 50, y: 0 }, size: { width: 200, height: 80 } };
    const span = rimToRimSpan(new StraightPath(parent.center, child.center), parent, child, ellipseShape);
    expect(span.end - span.start).toBe(0);
  });
});
