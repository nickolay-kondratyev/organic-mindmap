import { DEFAULT_CONFIG } from '../config/config';
import type { MindmapData, NodeId, Point } from '../model/node';
import { buildTree } from '../model/tree';
import { resolveNodeSizes } from '../size/nodeSizeResolver';
import { goldenRatioBowCurve } from './bowCurve';
import { collisionStage, resolveCollisions, type CollisionInput } from './collisionStage';
import type { NodePositions } from './layoutTypes';

const PADDING = 8;

// GIVEN a root and three children
const data: MindmapData = [
  { id: 'root', parentId: null, text: 'ROOT' },
  { id: 'a', parentId: 'root', text: 'A' },
  { id: 'b', parentId: 'root', text: 'B' },
  { id: 'c', parentId: 'root', text: 'C' },
];
const tree = buildTree(data);
const sizes = resolveNodeSizes(tree, DEFAULT_CONFIG.node);
const input: CollisionInput = { tree, sizes, padding: PADDING };

function anyPaddedBoxesOverlap(positions: NodePositions): boolean {
  const ids = [...positions.keys()];
  // A hair of tolerance: boxes that exactly touch the padding boundary are clear.
  const tolerance = 1e-6;
  return ids.some((a, i) =>
    ids.slice(i + 1).some((b) => {
      const pa = positions.get(a)!;
      const pb = positions.get(b)!;
      const sa = sizes.get(a)!;
      const sb = sizes.get(b)!;
      return (
        Math.abs(pa.x - pb.x) < (sa.width + sb.width) / 2 + PADDING - tolerance &&
        Math.abs(pa.y - pb.y) < (sa.height + sb.height) / 2 + PADDING - tolerance
      );
    }),
  );
}

const stacked = (): Map<NodeId, Point> =>
  new Map<NodeId, Point>([
    ['root', { x: 0, y: 0 }],
    ['a', { x: 300, y: 0 }],
    ['b', { x: 300, y: 5 }],
    ['c', { x: 305, y: 10 }],
  ]);

describe('GIVEN several nodes stacked on top of each other', () => {
  it('WHEN resolved THEN no padded boxes overlap', () => {
    expect(anyPaddedBoxesOverlap(resolveCollisions(stacked(), input))).toBe(false);
  });

  it('WHEN resolved THEN the input map is left untouched', () => {
    const before = stacked();
    resolveCollisions(before, input);
    expect(before).toEqual(stacked());
  });
});

describe('GIVEN a node overlapping the root', () => {
  const overlapping = new Map<NodeId, Point>([
    ['root', { x: 0, y: 0 }],
    ['a', { x: 10, y: 10 }],
  ]);

  it('WHEN resolved THEN the root does not move', () => {
    expect(resolveCollisions(overlapping, input).get('root')).toEqual({ x: 0, y: 0 });
  });

  it('WHEN resolved THEN the overlap is gone', () => {
    expect(anyPaddedBoxesOverlap(resolveCollisions(overlapping, input))).toBe(false);
  });
});

describe('GIVEN a pinned non-root node overlapped by a free one', () => {
  const pinnedInput: CollisionInput = { ...input, pinnedGroups: [new Set(['a'])] };
  const overlapping = new Map<NodeId, Point>([
    ['root', { x: 0, y: 0 }],
    ['a', { x: 300, y: 0 }],
    ['b', { x: 310, y: 10 }],
  ]);

  it('WHEN resolved THEN the pinned node does not move', () => {
    expect(resolveCollisions(overlapping, pinnedInput).get('a')).toEqual({ x: 300, y: 0 });
  });

  it('WHEN resolved THEN the free node is pushed clear', () => {
    expect(anyPaddedBoxesOverlap(resolveCollisions(overlapping, pinnedInput))).toBe(false);
  });
});

describe('GIVEN two nodes of one pinned group overlapping each other', () => {
  const bothPinned: CollisionInput = { ...input, pinnedGroups: [new Set(['a', 'b'])] };
  const overlapping = new Map<NodeId, Point>([
    ['root', { x: 0, y: 0 }],
    ['a', { x: 300, y: 0 }],
    ['b', { x: 305, y: 5 }],
  ]);

  it('WHEN resolved THEN neither pinned node moves', () => {
    const resolved = resolveCollisions(overlapping, bothPinned);
    expect([resolved.get('a'), resolved.get('b')]).toEqual([overlapping.get('a'), overlapping.get('b')]);
  });
});

describe('GIVEN nodes of an earlier and a later pinned group overlapping each other', () => {
  const twoGroups: CollisionInput = { ...input, pinnedGroups: [new Set(['a']), new Set(['b'])] };
  const overlapping = new Map<NodeId, Point>([
    ['root', { x: 0, y: 0 }],
    ['a', { x: 300, y: 0 }],
    ['b', { x: 305, y: 5 }],
  ]);

  it('WHEN resolved THEN the later group does not move', () => {
    expect(resolveCollisions(overlapping, twoGroups).get('b')).toEqual({ x: 305, y: 5 });
  });

  it('WHEN resolved THEN the earlier group yields until the overlap is gone', () => {
    expect(anyPaddedBoxesOverlap(resolveCollisions(overlapping, twoGroups))).toBe(false);
  });
});

describe('GIVEN a node of an earlier pinned group overlapped by a free node', () => {
  const twoGroups: CollisionInput = { ...input, pinnedGroups: [new Set(['a']), new Set(['c'])] };
  const overlapping = new Map<NodeId, Point>([
    ['root', { x: 0, y: 0 }],
    ['a', { x: 300, y: 0 }],
    ['b', { x: 310, y: 10 }],
    ['c', { x: 300, y: 400 }],
  ]);

  it('WHEN resolved THEN the pinned node does not yield to the free one', () => {
    expect(resolveCollisions(overlapping, twoGroups).get('a')).toEqual({ x: 300, y: 0 });
  });
});

describe('GIVEN the collision stage in a layout context', () => {
  it('WHEN run THEN it pushes overlapping nodes apart with the configured padding', () => {
    const context = {
      tree,
      sizes,
      config: { ...DEFAULT_CONFIG.layout, collisionPadding: PADDING },
      bowCurve: goldenRatioBowCurve,
    };
    expect(anyPaddedBoxesOverlap(collisionStage.run(stacked(), context))).toBe(false);
  });
});
