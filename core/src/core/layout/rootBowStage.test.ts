import { DEFAULT_CONFIG } from '../config/config';
import type { MindmapData, NodeId, Point } from '../model/node';
import { buildTree } from '../model/tree';
import { resolveNodeSizes } from '../size/nodeSizeResolver';
import { goldenRatioBowCurve, type BowCurve } from './bowCurve';
import type { LayoutContext } from './layoutTypes';
import { rootBowStage } from './rootBowStage';

const BOW_OFFSET = 100;
const FIRST_LEVEL_X = 200;
const CHILD_X = 400;

// GIVEN four right-side first-level nodes in one column (one with a child) and one left-side node
const data: MindmapData = [
  { id: 'root', parentId: null, text: 'ROOT' },
  { id: 'top', parentId: 'root', text: 'TOP', side: 'right' },
  { id: 'top-child', parentId: 'top', text: 'Child' },
  { id: 'upper', parentId: 'root', text: 'UPPER', side: 'right' },
  { id: 'lower', parentId: 'root', text: 'LOWER', side: 'right' },
  { id: 'bottom', parentId: 'root', text: 'BOTTOM', side: 'right' },
  { id: 'left', parentId: 'root', text: 'LEFT', side: 'left' },
];
const columnPositions = new Map<NodeId, Point>([
  ['root', { x: 0, y: 0 }],
  ['top', { x: FIRST_LEVEL_X, y: -150 }],
  ['top-child', { x: CHILD_X, y: -150 }],
  ['upper', { x: FIRST_LEVEL_X, y: -50 }],
  ['lower', { x: FIRST_LEVEL_X, y: 50 }],
  ['bottom', { x: FIRST_LEVEL_X, y: 150 }],
  ['left', { x: -FIRST_LEVEL_X, y: -80 }],
]);

function contextWith(bowCurve: BowCurve): LayoutContext {
  const tree = buildTree(data);
  return {
    tree,
    sizes: resolveNodeSizes(tree, DEFAULT_CONFIG.node),
    config: { ...DEFAULT_CONFIG.layout, bowOffset: BOW_OFFSET },
    bowCurve,
  };
}

describe('GIVEN a column of first-level nodes and the default golden-ratio bow', () => {
  const bowed = rootBowStage.run(columnPositions, contextWith(goldenRatioBowCurve));
  const x = (id: NodeId): number => bowed.get(id)!.x;

  it('WHEN bowed THEN the top node sits farther out than the middle ones', () => {
    expect(x('top')).toBeGreaterThan(Math.max(x('upper'), x('lower')));
  });

  it('WHEN bowed THEN the bottom node sits farther out than the middle ones', () => {
    expect(x('bottom')).toBeGreaterThan(Math.max(x('upper'), x('lower')));
  });

  it('WHEN bowed THEN a child moves by the same amount as its first-level node', () => {
    expect(x('top-child') - CHILD_X).toBeCloseTo(x('top') - FIRST_LEVEL_X);
  });

  it('WHEN bowed THEN the root does not move', () => {
    expect(bowed.get('root')).toEqual({ x: 0, y: 0 });
  });

  it('WHEN bowed THEN left-side nodes move further left', () => {
    expect(x('left')).toBeLessThan(-FIRST_LEVEL_X);
  });

  it('WHEN bowed THEN vertical positions are unchanged', () => {
    expect([...bowed].every(([id, p]) => p.y === columnPositions.get(id)!.y)).toBe(true);
  });
});

describe('GIVEN a host-supplied linear bow curve', () => {
  const linear: BowCurve = (t) => t;

  it('WHEN bowed THEN the offset follows that curve', () => {
    const bowed = rootBowStage.run(columnPositions, contextWith(linear));
    // `upper` is a third of the farthest distance (50 of 150).
    expect(bowed.get('upper')!.x).toBeCloseTo(FIRST_LEVEL_X + BOW_OFFSET / 3);
  });
});

describe('GIVEN a side whose only first-level node is level with the root', () => {
  const levelPositions = new Map<NodeId, Point>([...columnPositions, ['left', { x: -FIRST_LEVEL_X, y: 0 }]]);

  it('WHEN bowed THEN that node gets the curve value at distance 0', () => {
    const bowed = rootBowStage.run(levelPositions, contextWith(goldenRatioBowCurve));
    expect(bowed.get('left')!.x).toBeCloseTo(-FIRST_LEVEL_X - goldenRatioBowCurve(0) * BOW_OFFSET);
  });
});
