import { DEFAULT_CONFIG } from '../config/config';
import type { MindmapData, NodeId, Point } from '../model/node';
import { buildTree } from '../model/tree';
import { resolveNodeSizes } from '../size/nodeSizeResolver';
import { goldenRatioBowCurve } from './bowCurve';
import { handDrawnJitterStage } from './handDrawnJitterStage';
import type { LayoutContext, NodePositions } from './layoutTypes';

const AMPLITUDE = 10;

function contextFor(data: MindmapData, jitterAmplitude = AMPLITUDE): LayoutContext {
  const tree = buildTree(data);
  return {
    tree,
    sizes: resolveNodeSizes(tree, DEFAULT_CONFIG.node),
    config: { ...DEFAULT_CONFIG.layout, jitterAmplitude },
    bowCurve: goldenRatioBowCurve,
  };
}

/** Every node starts at the origin, so the output positions are the offsets themselves. */
function originPositions(data: MindmapData): NodePositions {
  return new Map<NodeId, Point>(data.map((n) => [n.id, { x: 0, y: 0 }]));
}

// GIVEN a root with a few children, all at the origin
const data: MindmapData = [
  { id: 'root', parentId: null, text: 'ROOT' },
  { id: 'a', parentId: 'root', text: 'A' },
  { id: 'b', parentId: 'root', text: 'B' },
  { id: 'c', parentId: 'a', text: 'C' },
];

describe('GIVEN nodes at the origin and a jitter amplitude', () => {
  const jittered = handDrawnJitterStage.run(originPositions(data), contextFor(data));

  it('WHEN jittered twice THEN both results are identical', () => {
    expect([...handDrawnJitterStage.run(originPositions(data), contextFor(data))]).toEqual([...jittered]);
  });

  it('WHEN jittered THEN the root does not move', () => {
    expect(jittered.get('root')).toEqual({ x: 0, y: 0 });
  });

  it('WHEN jittered THEN every offset stays within the amplitude on both axes', () => {
    expect([...jittered.values()].every((p) => Math.abs(p.x) <= AMPLITUDE && Math.abs(p.y) <= AMPLITUDE)).toBe(true);
  });

  it('WHEN jittered THEN nodes get different offsets', () => {
    expect(new Set(['a', 'b', 'c'].map((id) => JSON.stringify(jittered.get(id)))).size).toBe(3);
  });

  it('WHEN a node is added THEN the existing nodes keep their offsets', () => {
    const grown: MindmapData = [...data, { id: 'd', parentId: 'b', text: 'D' }];
    const regrown = handDrawnJitterStage.run(originPositions(grown), contextFor(grown));
    expect(['a', 'b', 'c'].map((id) => regrown.get(id))).toEqual(['a', 'b', 'c'].map((id) => jittered.get(id)));
  });
});

describe('GIVEN a jitter amplitude of zero', () => {
  it('WHEN jittered THEN no node moves', () => {
    const jittered = handDrawnJitterStage.run(originPositions(data), contextFor(data, 0));
    expect([...jittered.values()].every((p) => p.x === 0 && p.y === 0)).toBe(true);
  });
});
