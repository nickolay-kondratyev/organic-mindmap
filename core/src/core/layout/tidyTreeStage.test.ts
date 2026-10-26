import { DEFAULT_CONFIG } from '../config/config';
import type { MindmapData, NodeId } from '../model/node';
import { REFERENCE_DATA } from '../model/referenceData';
import { buildTree } from '../model/tree';
import { resolveNodeSizes } from '../size/nodeSizeResolver';
import { goldenRatioBowCurve } from './bowCurve';
import type { LayoutConfig } from './layoutConfig';
import type { LayoutContext, NodePositions } from './layoutTypes';
import { tidyTreeStage } from './tidyTreeStage';

function contextFor(data: MindmapData, layout: LayoutConfig = DEFAULT_CONFIG.layout): LayoutContext {
  const tree = buildTree(data, layout.sideOrder);
  return { tree, sizes: resolveNodeSizes(tree, DEFAULT_CONFIG.node), config: layout, bowCurve: goldenRatioBowCurve };
}

function anyBoxesOverlap(positions: NodePositions, context: LayoutContext): boolean {
  const ids = [...positions.keys()];
  return ids.some((a, i) =>
    ids.slice(i + 1).some((b) => {
      const pa = positions.get(a)!;
      const pb = positions.get(b)!;
      const sa = context.sizes.get(a)!;
      const sb = context.sizes.get(b)!;
      return Math.abs(pa.x - pb.x) < (sa.width + sb.width) / 2 && Math.abs(pa.y - pb.y) < (sa.height + sb.height) / 2;
    }),
  );
}

describe('GIVEN the reference data', () => {
  const context = contextFor(REFERENCE_DATA);
  const positions = tidyTreeStage.run(new Map(), context);
  const y = (id: NodeId): number => positions.get(id)!.y;

  it('WHEN laid out THEN the root sits at the origin', () => {
    expect(positions.get('root')).toEqual({ x: 0, y: 0 });
  });

  it('WHEN laid out THEN no two node boxes overlap', () => {
    expect(anyBoxesOverlap(positions, context)).toBe(false);
  });

  it('WHEN laid out THEN the right side is vertically centered on the root', () => {
    expect((y('vida') + y('historia')) / 2).toBeCloseTo(0);
  });

  it('WHEN laid out THEN the left side is vertically centered on the root', () => {
    expect((y('tragedia') + y('magia')) / 2).toBeCloseTo(0);
  });

  it('WHEN laid out THEN first-level nodes run top to bottom in data order', () => {
    expect(['vida', 'poesia', 'comedia', 'historia'].map(y)).toEqual(['vida', 'poesia', 'comedia', 'historia'].map(y).sort((a, b) => a - b));
  });

  it('WHEN laid out THEN a child sits outward of its parent by the horizontal gap between their boxes', () => {
    const parentWidth = context.sizes.get('vida')!.width;
    const childWidth = context.sizes.get('hamlet')!.width;
    const expectedStep = parentWidth / 2 + DEFAULT_CONFIG.layout.horizontalGap + childWidth / 2;
    expect(positions.get('hamlet')!.x - positions.get('vida')!.x).toBeCloseTo(expectedStep);
  });

  it('WHEN laid out THEN left-side descendants grow further left than their parent', () => {
    expect(positions.get('macbeth')!.x).toBeLessThan(positions.get('tragedia')!.x);
  });
});

describe('GIVEN a first-level node whose explicit side differs from the alternating default', () => {
  // Without `side`, the first first-level node would alternate to the right.
  const data: MindmapData = [
    { id: 'root', parentId: null, text: 'ROOT' },
    { id: 'a', parentId: 'root', text: 'A', side: 'left' },
  ];

  it('WHEN laid out THEN it is placed on its explicit side', () => {
    expect(tidyTreeStage.run(new Map(), contextFor(data)).get('a')!.x).toBeLessThan(0);
  });
});

describe('GIVEN nodes on the right side only', () => {
  const data: MindmapData = [
    { id: 'root', parentId: null, text: 'ROOT' },
    { id: 'a', parentId: 'root', text: 'A', side: 'right' },
    { id: 'b', parentId: 'root', text: 'B', side: 'right' },
  ];

  it('WHEN laid out THEN every node is positioned', () => {
    expect(tidyTreeStage.run(new Map(), contextFor(data)).size).toBe(data.length);
  });
});

describe('GIVEN a node with a data size override', () => {
  const tall = { width: 100, height: 300 };
  const data: MindmapData = [
    { id: 'root', parentId: null, text: 'ROOT' },
    { id: 'a', parentId: 'root', text: 'A', side: 'right', size: tall },
    { id: 'b', parentId: 'root', text: 'B', side: 'right' },
  ];

  it('WHEN laid out THEN its siblings are spaced by its own height', () => {
    const context = contextFor(data);
    const positions = tidyTreeStage.run(new Map(), context);
    const expectedDistance = (tall.height + context.sizes.get('b')!.height) / 2 + DEFAULT_CONFIG.layout.verticalGap;
    expect(positions.get('b')!.y - positions.get('a')!.y).toBeCloseTo(expectedDistance);
  });
});

describe('GIVEN the clockwise side order and four unsided first-level nodes', () => {
  const data: MindmapData = [
    { id: 'root', parentId: null, text: 'ROOT' },
    { id: 'a', parentId: 'root', text: 'A' },
    { id: 'b', parentId: 'root', text: 'B' },
    { id: 'c', parentId: 'root', text: 'C' },
    { id: 'd', parentId: 'root', text: 'D' },
  ];
  const positions = tidyTreeStage.run(new Map(), contextFor(data, { ...DEFAULT_CONFIG.layout, sideOrder: 'clockwise' }));
  const at = (id: NodeId) => positions.get(id)!;

  it('WHEN laid out THEN the right side reads top to bottom in data order', () => {
    expect(at('a').y).toBeLessThan(at('b').y);
  });

  it('WHEN laid out THEN the left side reads bottom to top in data order', () => {
    expect(at('c').y).toBeGreaterThan(at('d').y);
  });

  it('WHEN laid out THEN the second half sits on the left', () => {
    expect([at('c').x, at('d').x].every((x) => x < 0)).toBe(true);
  });
});
