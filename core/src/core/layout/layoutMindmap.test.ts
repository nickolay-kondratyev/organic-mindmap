import { REFERENCE_DATA } from '../model/referenceData';
import type { NodeId, Point } from '../model/node';
import { layoutMindmap } from './layoutMindmap';

describe('GIVEN the reference data', () => {
  it('WHEN laid out with zero config THEN every node gets a position', () => {
    expect([...layoutMindmap(REFERENCE_DATA).keys()].sort()).toEqual(REFERENCE_DATA.map((n) => n.id).sort());
  });

  it('WHEN laid out with host stages THEN those stages decide the positions', () => {
    const everyNodeAtOrigin = {
      name: 'origin',
      run: () => new Map<NodeId, Point>(REFERENCE_DATA.map((n) => [n.id, { x: 0, y: 0 }])),
    };
    const positions = layoutMindmap(REFERENCE_DATA, { extensions: { layoutStages: [everyNodeAtOrigin] } });
    expect(positions.get('vida')).toEqual({ x: 0, y: 0 });
  });

  it('WHEN laid out with a layout config override THEN the override is used', () => {
    const wide = layoutMindmap(REFERENCE_DATA, { config: { layout: { horizontalGap: 1000 } } });
    expect(Math.abs(wide.get('vida')!.x)).toBeGreaterThan(1000);
  });
});
