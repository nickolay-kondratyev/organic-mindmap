import { buildTree } from '../model/tree';
import { REFERENCE_DATA } from '../model/referenceData';
import { resolveNodeSizes } from '../size/nodeSizeResolver';
import { DEFAULT_CONFIG } from '../config/config';
import { goldenRatioBowCurve } from './bowCurve';
import { defaultLayoutStages, runLayoutPipeline } from './pipeline';
import type { LayoutContext, LayoutStage } from './layoutTypes';

describe('runLayoutPipeline', () => {
  // GIVEN the reference data and default context
  const tree = buildTree(REFERENCE_DATA);
  const context: LayoutContext = {
    tree,
    sizes: resolveNodeSizes(tree, DEFAULT_CONFIG.node),
    config: DEFAULT_CONFIG.layout,
    bowCurve: goldenRatioBowCurve,
  };

  it('WHEN running the default stages THEN every node gets a position', () => {
    const positions = runLayoutPipeline(context, defaultLayoutStages(context.config));
    expect([...positions.keys()].sort()).toEqual(REFERENCE_DATA.map((n) => n.id).sort());
  });

  it('WHEN running the default stages THEN left-side nodes are left of the root and right-side nodes right of it', () => {
    const positions = runLayoutPipeline(context, defaultLayoutStages(context.config));
    const signs = REFERENCE_DATA.filter((n) => n.parentId !== null).map((n) => ({
      side: tree.sideOf(n.id),
      sign: Math.sign(positions.get(n.id)?.x ?? 0),
    }));
    expect(signs.every((s) => (s.side === 'left' ? s.sign === -1 : s.sign === 1))).toBe(true);
  });

  it('WHEN asked for the bilateral defaults THEN the stages run tree, bow, jitter, collision in that order', () => {
    expect(defaultLayoutStages(context.config).map((s) => s.name)).toEqual(['tidy-tree', 'root-bow', 'hand-drawn-jitter', 'collision']);
  });

  it('WHEN running the default stages twice THEN the positions are identical', () => {
    const first = runLayoutPipeline(context, defaultLayoutStages(context.config));
    expect([...runLayoutPipeline(context, defaultLayoutStages(context.config))]).toEqual([...first]);
  });

  it('WHEN running the default stages THEN the root stays at the origin', () => {
    expect(runLayoutPipeline(context, defaultLayoutStages(context.config)).get('root')).toEqual({ x: 0, y: 0 });
  });

  it('WHEN running the default stages THEN no node boxes overlap', () => {
    const positions = runLayoutPipeline(context, defaultLayoutStages(context.config));
    const ids = [...positions.keys()];
    const overlapping = ids.some((a, i) =>
      ids.slice(i + 1).some((b) => {
        const pa = positions.get(a)!;
        const pb = positions.get(b)!;
        const sa = context.sizes.get(a)!;
        const sb = context.sizes.get(b)!;
        return Math.abs(pa.x - pb.x) < (sa.width + sb.width) / 2 && Math.abs(pa.y - pb.y) < (sa.height + sb.height) / 2;
      }),
    );
    expect(overlapping).toBe(false);
  });

  it.each([
    { side: 'right', outer: ['vida', 'historia'], middle: ['poesia', 'comedia'] },
    { side: 'left', outer: ['tragedia', 'magia'], middle: ['sonetos', 'amor'] },
  ])('WHEN running the default stages THEN on the $side side top and bottom sit farther out than the middle (spec §8 Spread)', ({ outer, middle }) => {
    const positions = runLayoutPipeline(context, defaultLayoutStages(context.config));
    const reach = (id: string): number => Math.abs(positions.get(id)!.x);
    expect(Math.min(...outer.map(reach))).toBeGreaterThan(Math.max(...middle.map(reach)));
  });

  it('WHEN the host removes a default stage THEN the remaining stages still position every node', () => {
    const withoutJitter = defaultLayoutStages(context.config).filter((s) => s.name !== 'hand-drawn-jitter');
    expect(runLayoutPipeline(context, withoutJitter).size).toBe(REFERENCE_DATA.length);
  });

  it('WHEN the host supplies its own stage list THEN exactly those stages run in order', () => {
    const calls: string[] = [];
    const stage = (name: string): LayoutStage => ({
      name,
      run: (positions) => {
        calls.push(name);
        return positions;
      },
    });
    runLayoutPipeline(context, [stage('one'), stage('two')]);
    expect(calls).toEqual(['one', 'two']);
  });
});
