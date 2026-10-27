import type { NodePositions } from '../layout/layoutTypes';
import type { MindmapData, NodeId, NodeSize, Point } from '../model/node';
import { buildTree } from '../model/tree';
import { ellipseShape } from '../shape/nodeShape';
import { HANDLE_GAP, HANDLE_RADIUS, nodeAt, nodeHandles, pointerTargetAt, sameHandle, type HitScene } from './hitTest';

const NODE_SIZE: NodeSize = { width: 100, height: 40 };
const HALF_WIDTH = NODE_SIZE.width / 2;
const HALF_HEIGHT = NODE_SIZE.height / 2;
const HANDLE_REACH_X = HALF_WIDTH + HANDLE_GAP + HANDLE_RADIUS;

// GIVEN a root, a right node `r`, a left node `l`, and `top` drawn last and overlapping `r`
const data: MindmapData = [
  { id: 'root', parentId: null, text: 'ROOT' },
  { id: 'r', parentId: 'root', text: 'R', side: 'right' },
  { id: 'l', parentId: 'root', text: 'L', side: 'left' },
  { id: 'top', parentId: 'root', text: 'T', side: 'right' },
];
const positions: NodePositions = new Map<NodeId, Point>([
  ['root', { x: 0, y: 0 }],
  ['r', { x: 300, y: 0 }],
  ['l', { x: -300, y: 0 }],
  ['top', { x: 340, y: 0 }],
]);
const scene: HitScene = {
  tree: buildTree(data),
  positions,
  sizes: new Map(data.map((node) => [node.id, NODE_SIZE])),
};

describe('nodeAt', () => {
  it('WHEN the point is inside a node THEN that node is hit', () => {
    expect(nodeAt(scene, { x: -300, y: 10 }, ellipseShape)).toBe('l');
  });

  it('WHEN the point is in empty canvas THEN nothing is hit', () => {
    expect(nodeAt(scene, { x: 0, y: 200 }, ellipseShape)).toBeNull();
  });

  it('WHEN the point is in the bounding box corner outside the ellipse THEN nothing is hit', () => {
    expect(nodeAt(scene, { x: -300 + HALF_WIDTH - 1, y: HALF_HEIGHT - 1 }, ellipseShape)).toBeNull();
  });

  it('WHEN two nodes overlap at the point THEN the one painted last wins', () => {
    expect(nodeAt(scene, { x: 320, y: 0 }, ellipseShape)).toBe('top');
  });

  it('WHEN the top node is excluded THEN the node beneath it is hit', () => {
    expect(nodeAt(scene, { x: 320, y: 0 }, ellipseShape, new Set(['top']))).toBe('r');
  });
});

describe('nodeHandles', () => {
  it('WHEN asked for a right-side node THEN it offers a "+" on each side', () => {
    expect(nodeHandles(scene, 'r').map((handle) => handle.side)).toEqual(['left', 'right']);
  });

  it('WHEN asked for a right-side node THEN its "+" buttons sit just left and just right of it', () => {
    expect(nodeHandles(scene, 'r').map((handle) => handle.center)).toEqual([
      { x: 300 - HANDLE_REACH_X, y: 0 },
      { x: 300 + HANDLE_REACH_X, y: 0 },
    ]);
  });

  it('WHEN asked for a left-side node THEN its "+" buttons sit just left and just right of it', () => {
    expect(nodeHandles(scene, 'l').map((handle) => handle.center)).toEqual([
      { x: -300 - HANDLE_REACH_X, y: 0 },
      { x: -300 + HANDLE_REACH_X, y: 0 },
    ]);
  });

  it('WHEN asked for a non-root node THEN both "+" add a child of that node (no delete button)', () => {
    const actions = nodeHandles(scene, 'l').map((handle) => ({ kind: handle.kind, nodeId: handle.nodeId }));
    expect(actions).toEqual([
      { kind: 'add-child', nodeId: 'l' },
      { kind: 'add-child', nodeId: 'l' },
    ]);
  });

  it('WHEN asked for the root THEN it offers a "+" for each side', () => {
    const sides = nodeHandles(scene, 'root').map((handle) => handle.side);
    expect(sides).toEqual(['left', 'right']);
  });
});

describe('pointerTargetAt', () => {
  const plusOfLeft: Point = { x: -300 - HANDLE_REACH_X, y: 0 };
  /** The "+" of the left node `l` on its inner side, facing the root. */
  const innerPlusOfLeft: Point = { x: -300 + HANDLE_REACH_X, y: 0 };

  it('GIVEN the node is hovered WHEN the point is on its "+" THEN the "+" button is hit', () => {
    const target = pointerTargetAt(scene, plusOfLeft, ellipseShape, 'l');
    expect(target.kind === 'handle' && target.handle.kind).toBe('add-child');
  });

  it('GIVEN the node is hovered WHEN the point is on its inner-side "+" THEN that "+" of the node is hit', () => {
    const target = pointerTargetAt(scene, innerPlusOfLeft, ellipseShape, 'l');
    expect(target.kind === 'handle' && { nodeId: target.handle.nodeId, side: target.handle.side }).toEqual({ nodeId: 'l', side: 'right' });
  });

  it('GIVEN the node is hovered WHEN the point is in the gap between it and its inner-side "+" THEN the node keeps its hover', () => {
    const innerGap = { x: -300 + HALF_WIDTH + HANDLE_GAP / 2, y: 0 };
    expect(pointerTargetAt(scene, innerGap, ellipseShape, 'l')).toEqual({ kind: 'near-handles', nodeId: 'l' });
  });

  it('GIVEN no node is hovered WHEN the point is where a "+" would be THEN it is empty canvas', () => {
    expect(pointerTargetAt(scene, plusOfLeft, ellipseShape, null)).toEqual({ kind: 'empty' });
  });

  it('GIVEN a node is hovered WHEN the point is on another node THEN that node is hit', () => {
    expect(pointerTargetAt(scene, { x: 0, y: 0 }, ellipseShape, 'l')).toEqual({ kind: 'node', nodeId: 'root' });
  });

  it('GIVEN the node is hovered WHEN the point is in the gap between it and its "+" THEN the node keeps its hover', () => {
    const gap = { x: -300 - HALF_WIDTH - HANDLE_GAP / 2, y: 0 };
    expect(pointerTargetAt(scene, gap, ellipseShape, 'l')).toEqual({ kind: 'near-handles', nodeId: 'l' });
  });

  it('GIVEN the node is hovered WHEN the point is in its hover area but on a neighbouring node THEN the neighbour is hit', () => {
    // Inside `r`'s hover area, off its "+" and off `r` itself, but on `top` (centered at x 340).
    const onNeighbour = { x: 300 + HALF_WIDTH + 3, y: HALF_HEIGHT - 5 };
    expect(pointerTargetAt(scene, onNeighbour, ellipseShape, 'r')).toEqual({ kind: 'node', nodeId: 'top' });
  });

  it('GIVEN no node is hovered WHEN the point is in the gap next to a node THEN it is empty canvas', () => {
    const gap = { x: -300 - HALF_WIDTH - HANDLE_GAP / 2, y: 0 };
    expect(pointerTargetAt(scene, gap, ellipseShape, null)).toEqual({ kind: 'empty' });
  });

  it('GIVEN the node is hovered WHEN the point is just above its bounding box THEN it is empty canvas', () => {
    const justAbove = { x: -300, y: -HALF_HEIGHT - 1 };
    expect(pointerTargetAt(scene, justAbove, ellipseShape, 'l')).toEqual({ kind: 'empty' });
  });

  it('GIVEN the node is hovered WHEN the point is just outside its "+" THEN the "+" is not hit', () => {
    const justOutside = { x: plusOfLeft.x - HANDLE_RADIUS - 1, y: 0 };
    expect(pointerTargetAt(scene, justOutside, ellipseShape, 'l')).toEqual({ kind: 'empty' });
  });
});

describe('sameHandle', () => {
  const [left, right] = nodeHandles(scene, 'root');

  it('WHEN the same button is rebuilt from the scene THEN it is the same handle', () => {
    expect(sameHandle(nodeHandles(scene, 'root')[0] ?? null, left ?? null)).toBe(true);
  });

  it('WHEN the root "+" buttons of both sides are compared THEN they differ', () => {
    expect(sameHandle(left ?? null, right ?? null)).toBe(false);
  });

  it('WHEN the "+" buttons of both sides of a non-root node are compared THEN they differ', () => {
    const [nodeLeft, nodeRight] = nodeHandles(scene, 'l');
    expect(sameHandle(nodeLeft ?? null, nodeRight ?? null)).toBe(false);
  });
});
