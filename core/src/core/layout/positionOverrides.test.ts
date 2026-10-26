import { DEFAULT_CONFIG } from '../config/config';
import type { MindmapData, NodeId, Point } from '../model/node';
import { buildTree } from '../model/tree';
import { resolveNodeSizes } from '../size/nodeSizeResolver';
import type { NodePositions } from './layoutTypes';
import {
  applyPositionOverrides,
  moveSubtree,
  NO_POSITION_OVERRIDES,
  subtreeMoveBy,
  subtreeMoveTo,
  withNodeDropped,
  withoutSubtree,
  type PositionOverrides,
  type SubtreeMove,
} from './positionOverrides';

const PADDING = 8;

// GIVEN a root with a parent `a` (child `a1`) on the right and a separate node `b` below `a`
const data: MindmapData = [
  { id: 'root', parentId: null, text: 'ROOT' },
  { id: 'a', parentId: 'root', text: 'A', side: 'right' },
  { id: 'a1', parentId: 'a', text: 'A1' },
  { id: 'b', parentId: 'root', text: 'B', side: 'right' },
];
const tree = buildTree(data);
const sizes = resolveNodeSizes(tree, DEFAULT_CONFIG.node);
const positions: NodePositions = new Map<NodeId, Point>([
  ['root', { x: 0, y: 0 }],
  ['a', { x: 300, y: -100 }],
  ['a1', { x: 500, y: -100 }],
  ['b', { x: 300, y: 200 }],
]);

function apply(overrides: PositionOverrides): NodePositions {
  return applyPositionOverrides(positions, { tree, sizes, padding: PADDING, overrides });
}

/** Moves `nodeId` (and its subtree) in `from` so the node lands at `to`; the node must have a position there. */
function moveTo(from: NodePositions, nodeId: NodeId, to: Point): SubtreeMove {
  return subtreeMoveTo(from, tree, nodeId, to)!;
}

function boxesOverlap(result: NodePositions, idA: NodeId, idB: NodeId): boolean {
  const pa = result.get(idA)!;
  const pb = result.get(idB)!;
  const sa = sizes.get(idA)!;
  const sb = sizes.get(idB)!;
  return Math.abs(pa.x - pb.x) < (sa.width + sb.width) / 2 && Math.abs(pa.y - pb.y) < (sa.height + sb.height) / 2;
}

describe('moveSubtree', () => {
  const sameSide = subtreeMoveBy(positions, tree, 'a', { x: 10, y: 20 })!;

  it('WHEN moving a parent on its side of the root THEN its child moves by the same delta', () => {
    expect(moveSubtree(positions, tree, sameSide).get('a1')).toEqual({ x: 510, y: -80 });
  });

  it('WHEN moving a parent THEN unrelated nodes stay put', () => {
    expect(moveSubtree(positions, tree, sameSide).get('b')).toEqual({ x: 300, y: 200 });
  });

  it('WHEN moving a parent across the root THEN its child is mirrored to the far side of it', () => {
    expect(moveSubtree(positions, tree, moveTo(positions, 'a', { x: -300, y: -80 })).get('a1')).toEqual({ x: -500, y: -80 });
  });

  it('WHEN a mirrored parent is moved back across the root THEN its child points right again', () => {
    const mirrored = moveSubtree(positions, tree, moveTo(positions, 'a', { x: -300, y: -100 }));
    expect(moveSubtree(mirrored, tree, moveTo(mirrored, 'a', { x: 300, y: -100 })).get('a1')).toEqual({ x: 500, y: -100 });
  });
});

describe('subtreeMoveBy (the drag preview)', () => {
  it('WHEN a node is dragged past its parent THEN the move mirrors', () => {
    expect(subtreeMoveBy(positions, tree, 'a', { x: -600, y: 0 })?.mirrored).toBe(true);
  });

  it('WHEN a node is dragged but stays on its side of the parent THEN the move does not mirror', () => {
    expect(subtreeMoveBy(positions, tree, 'a', { x: -250, y: 0 })?.mirrored).toBe(false);
  });

  it('WHEN a node is dragged exactly onto its parent\'s centre line THEN it counts as the right side (no mirror)', () => {
    expect(subtreeMoveBy(positions, tree, 'a', { x: -300, y: 0 })?.mirrored).toBe(false);
  });

  it('WHEN the root is dragged THEN the move never mirrors', () => {
    expect(subtreeMoveBy(positions, tree, 'root', { x: -50, y: 0 })?.mirrored).toBe(false);
  });

  it('WHEN a node without a position is dragged THEN there is no move', () => {
    expect(subtreeMoveBy(positions, tree, 'gone', { x: 1, y: 1 })).toBeNull();
  });
});

describe('applyPositionOverrides', () => {
  it('GIVEN no overrides WHEN applied THEN the layout positions are returned untouched', () => {
    expect(apply(NO_POSITION_OVERRIDES)).toBe(positions);
  });

  it('GIVEN an override for a parent WHEN applied THEN the parent sits exactly at it', () => {
    expect(apply(new Map([['a', { x: 320, y: -60 }]])).get('a')).toEqual({ x: 320, y: -60 });
  });

  it('GIVEN an override for a parent WHEN applied THEN its child keeps its offset to the parent', () => {
    expect(apply(new Map([['a', { x: 320, y: -60 }]])).get('a1')).toEqual({ x: 520, y: -60 });
  });

  it('GIVEN overrides for a parent and its child WHEN applied THEN the child ends at its own override', () => {
    const result = apply(
      new Map([
        ['a', { x: 320, y: -60 }],
        ['a1', { x: 450, y: 0 }],
      ]),
    );
    expect(result.get('a1')).toEqual({ x: 450, y: 0 });
  });

  it('GIVEN an override across the root for a parent WHEN applied THEN its child is mirrored to the far side of it', () => {
    expect(apply(new Map([['a', { x: -300, y: -100 }]])).get('a1')).toEqual({ x: -500, y: -100 });
  });

  it('GIVEN an override for a node that no longer exists WHEN applied THEN it is ignored', () => {
    expect(apply(new Map([['gone', { x: 1, y: 1 }]]))).toBe(positions);
  });

  it('GIVEN an override that drops a node onto another WHEN applied THEN the other node is pushed clear', () => {
    const result = apply(new Map([['a', { x: 300, y: 195 }]]));
    expect(boxesOverlap(result, 'a', 'b')).toBe(false);
  });

  it('GIVEN an override that drops a node onto another WHEN applied THEN the overridden node does not yield', () => {
    expect(apply(new Map([['a', { x: 300, y: 195 }]])).get('a')).toEqual({ x: 300, y: 195 });
  });
});

describe('GIVEN a node dragged earlier and another node dropped onto it later', () => {
  // Map order is drop order: `b` was placed first, then `a` was dropped onto it.
  const overrides: PositionOverrides = new Map([
    ['b', { x: 300, y: 200 }],
    ['a', { x: 300, y: 195 }],
  ]);

  it('WHEN applied THEN the two no longer overlap', () => {
    expect(boxesOverlap(apply(overrides), 'a', 'b')).toBe(false);
  });

  it('WHEN applied THEN the later drop stays exactly where it was dropped', () => {
    expect(apply(overrides).get('a')).toEqual({ x: 300, y: 195 });
  });
});

describe('GIVEN a node dragged earlier onto a laid-out node and an unrelated later drop', () => {
  const overrides: PositionOverrides = new Map([
    ['b', { x: 300, y: -95 }],
    ['a1', { x: 700, y: 300 }],
  ]);

  it('WHEN applied THEN the earlier drop still does not yield to the laid-out node', () => {
    expect(apply(overrides).get('b')).toEqual({ x: 300, y: -95 });
  });
});

describe('GIVEN a child that was dragged earlier', () => {
  const earlier: PositionOverrides = new Map([['a1', { x: 520, y: -40 }]]);

  describe('WHEN its parent is dropped 10 right and 20 down', () => {
    const result = withNodeDropped(earlier, tree, { nodeId: 'a', from: { x: 300, y: -100 }, to: { x: 310, y: -80 }, mirrored: false });

    it('THEN the parent is recorded at its drop point', () => {
      expect(result.get('a')).toEqual({ x: 310, y: -80 });
    });

    it('THEN the child moves along by the same delta instead of snapping back', () => {
      expect(result.get('a1')).toEqual({ x: 530, y: -20 });
    });
  });

  describe('WHEN its parent is dropped across the root', () => {
    const scene = apply(earlier);
    const drop = moveTo(scene, 'a', { x: -300, y: -100 });
    const result = withNodeDropped(earlier, tree, drop);

    it('THEN the child stays mirrored relative to the parent', () => {
      expect(result.get('a1')).toEqual({ x: -520, y: -40 });
    });

    it('THEN the drawn child is where the drag preview showed it', () => {
      expect(apply(result).get('a1')).toEqual(moveSubtree(scene, tree, drop).get('a1'));
    });
  });

  it('WHEN the child is dropped again after its sibling subtree THEN it counts as the latest drop', () => {
    const afterOther = withNodeDropped(earlier, tree, { nodeId: 'b', from: { x: 300, y: 200 }, to: { x: 310, y: 220 }, mirrored: false });
    const result = withNodeDropped(afterOther, tree, { nodeId: 'a1', from: { x: 520, y: -40 }, to: { x: 530, y: -50 }, mirrored: false });
    expect([...result.keys()].at(-1)).toBe('a1');
  });

  it('WHEN an unrelated node is dropped THEN the child keeps its position', () => {
    const result = withNodeDropped(earlier, tree, { nodeId: 'b', from: { x: 300, y: 200 }, to: { x: 310, y: 220 }, mirrored: false });
    expect(result.get('a1')).toEqual({ x: 520, y: -40 });
  });

  it('WHEN the subtree of its parent is cleared THEN its override is gone', () => {
    expect(withoutSubtree(earlier, tree, 'a').has('a1')).toBe(false);
  });

  it('WHEN the subtree of an unrelated node is cleared THEN its override stays', () => {
    expect(withoutSubtree(earlier, tree, 'b').has('a1')).toBe(true);
  });
});

describe('GIVEN a three-level branch dragged across parents in successive drops', () => {
  // Spaced so the push-apart never moves anything: preview vs drop under collisions is the ceiling in `subtreeMoveTo`.
  const branch = buildTree([
    { id: 'root', parentId: null, text: 'ROOT' },
    { id: 'a', parentId: 'root', text: 'A', side: 'right' },
    { id: 'a1', parentId: 'a', text: 'A1' },
    { id: 'a11', parentId: 'a1', text: 'A11' },
  ]);
  const branchSizes = resolveNodeSizes(branch, DEFAULT_CONFIG.node);
  const laidOut: NodePositions = new Map<NodeId, Point>([
    ['root', { x: 0, y: 0 }],
    ['a', { x: 300, y: -200 }],
    ['a1', { x: 600, y: -300 }],
    ['a11', { x: 900, y: -400 }],
  ]);
  const drawn = (overrides: PositionOverrides): NodePositions =>
    applyPositionOverrides(laidOut, { tree: branch, sizes: branchSizes, padding: PADDING, overrides });
  // Flips the root's child, then its child inside the flipped subtree, then drags each back and forth again.
  const drops: readonly { readonly nodeId: NodeId; readonly to: Point }[] = [
    { nodeId: 'a', to: { x: -300, y: -200 } },
    { nodeId: 'a1', to: { x: -150, y: -350 } },
    { nodeId: 'a11', to: { x: -400, y: -600 } },
    { nodeId: 'a', to: { x: 300, y: -200 } },
    { nodeId: 'a1', to: { x: 450, y: -500 } },
    { nodeId: 'a', to: { x: -320, y: -220 } },
    { nodeId: 'a1', to: { x: -700, y: -350 } },
    { nodeId: 'a', to: { x: 200, y: -260 } },
  ];

  it('WHEN each drop lands THEN the drawn map is exactly what the drag preview showed', () => {
    let overrides: PositionOverrides = NO_POSITION_OVERRIDES;
    const mismatches: string[] = [];
    drops.forEach(({ nodeId, to }, index) => {
      const scene = drawn(overrides);
      const move = subtreeMoveTo(scene, branch, nodeId, to)!;
      overrides = withNodeDropped(overrides, branch, move);
      const preview = JSON.stringify([...moveSubtree(scene, branch, move)]);
      const afterDrop = JSON.stringify([...drawn(overrides)]);
      if (preview !== afterDrop) mismatches.push(`drop=[${index}] preview=[${preview}] afterDrop=[${afterDrop}]`);
    });
    expect(mismatches).toEqual([]);
  });
});
