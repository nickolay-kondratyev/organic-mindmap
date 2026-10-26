import { DEFAULT_CONFIG } from '../config/config';
import { DEFAULT_EXTENSIONS } from '../extensions';
import type { NodeId } from '../model/node';
import { REFERENCE_DATA } from '../model/referenceData';
import { buildScene } from './scene';

describe('buildScene', () => {
  // GIVEN the reference data with defaults
  const scene = buildScene(REFERENCE_DATA, DEFAULT_CONFIG, DEFAULT_EXTENSIONS);

  it('WHEN built THEN there is one branch per non-root node', () => {
    expect(scene.branches.length).toBe(REFERENCE_DATA.length - 1);
  });

  it('WHEN built THEN every branch starts at its parent center and ends at its child center', () => {
    const consistent = scene.branches.every((b) => {
      const start = b.path.sampleAt(0).point;
      const end = b.path.sampleAt(b.path.length).point;
      return (
        JSON.stringify(start) === JSON.stringify(scene.positions.get(b.parentId)) &&
        JSON.stringify(end) === JSON.stringify(scene.positions.get(b.childId))
      );
    });
    expect(consistent).toBe(true);
  });

  it('WHEN a host stage leaves a node unpositioned THEN building fails plainly naming the node', () => {
    const emptyStage = { name: 'empty', run: () => new Map() };
    expect(() => buildScene(REFERENCE_DATA, DEFAULT_CONFIG, { ...DEFAULT_EXTENSIONS, layoutStages: [emptyStage] })).toThrow(
      'no position for node [root]',
    );
  });
});

describe('GIVEN a position override for a first-level node', () => {
  // The root sits at the origin, so a first-level node's offset is its scene position.
  const dragged = { x: 500, y: 300 };
  const scene = buildScene(REFERENCE_DATA, DEFAULT_CONFIG, DEFAULT_EXTENSIONS, new Map([['vida', { dx: dragged.x, dy: dragged.y }]]));

  it('WHEN built THEN its incoming branch re-routes to end at the new position', () => {
    const branch = scene.branches.find((b) => b.childId === 'vida');
    expect(branch?.path.sampleAt(branch.path.length).point).toEqual(dragged);
  });
});

/**
 * Reported bug (repel too strong / missing): Tragedia was dragged up-right, then Sonetos was dropped right onto
 * it without hitting its shape (so a reposition, not a reparent). Drop points are the scene coordinates read off
 * the bug screenshot.
 */
describe('GIVEN Tragedia dragged earlier and Sonetos dropped onto it later', () => {
  const TRAGEDIA_DROP = { x: -303, y: -260 };
  const SONETOS_DROP = { x: -341, y: -233 };
  const ARC_SAMPLES = 40;
  // First-level nodes: offsets from the root at the origin are their scene positions.
  const overrides = new Map([
    ['tragedia', { dx: TRAGEDIA_DROP.x, dy: TRAGEDIA_DROP.y }],
    ['sonetos', { dx: SONETOS_DROP.x, dy: SONETOS_DROP.y }],
  ]);
  const scene = buildScene(REFERENCE_DATA, DEFAULT_CONFIG, DEFAULT_EXTENSIONS, overrides);

  function boxesOverlap(idA: NodeId, idB: NodeId): boolean {
    const pa = scene.positions.get(idA)!;
    const pb = scene.positions.get(idB)!;
    const sa = scene.sizes.get(idA)!;
    const sb = scene.sizes.get(idB)!;
    return Math.abs(pa.x - pb.x) < (sa.width + sb.width) / 2 && Math.abs(pa.y - pb.y) < (sa.height + sb.height) / 2;
  }

  it('WHEN built THEN Sonetos and Tragedia do not overlap', () => {
    expect(boxesOverlap('sonetos', 'tragedia')).toBe(false);
  });

  it('WHEN built THEN the Macbeth limb rises above its higher end by less than a node height (no bounce)', () => {
    const limb = scene.branches.find((b) => b.childId === 'macbeth')!;
    const ys = Array.from({ length: ARC_SAMPLES + 1 }, (_, i) => limb.path.sampleAt((limb.path.length * i) / ARC_SAMPLES).point.y);
    const higherEndY = Math.min(ys[0]!, ys[ARC_SAMPLES]!);
    const rise = higherEndY - Math.min(...ys);
    expect(rise).toBeLessThan(scene.sizes.get('macbeth')!.height);
  });
});
