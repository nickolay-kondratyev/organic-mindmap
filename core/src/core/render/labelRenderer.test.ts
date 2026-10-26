import { vendoredKalamBytes } from '../../../test-support/vendoredKalam';
import { DEFAULT_CONFIG } from '../config/config';
import { DEFAULT_EXTENSIONS } from '../extensions';
import type { MindmapData } from '../model/node';
import { REFERENCE_DATA } from '../model/referenceData';
import { GlyphRun } from '../text/glyphRun';
import type { PlacedGlyph } from '../text/glyphPlacement';
import { LoadedFont } from '../text/loadedFont';
import { drawLabels, layoutSceneBranchLabel, nodeLabelInk } from './labelRenderer';
import { buildScene } from './scene';

describe('nodeLabelInk', () => {
  // GIVEN the default config, where node text is not bold
  const config = DEFAULT_CONFIG;

  it('WHEN inking the root label THEN it is bold', () => {
    expect(nodeLabelInk(config, true).bold).toBe(true);
  });

  it('WHEN inking the root label THEN it uses the root text color', () => {
    expect(nodeLabelInk(config, true).fill).toBe(config.theme.color.root.text);
  });

  it('WHEN inking a non-root label THEN it follows the node text config', () => {
    expect(nodeLabelInk(config, false).bold).toBe(config.text.node.bold);
  });
});

describe('GIVEN the reference map with its real curved, routed limbs and the vendored Kalam font', () => {
  const scene = buildScene(REFERENCE_DATA, DEFAULT_CONFIG, DEFAULT_EXTENSIONS);
  const font = LoadedFont.parse(vendoredKalamBytes());
  const labels = scene.branches.map((branch) => {
    const run = new GlyphRun(font.shape(scene.tree.nodeById(branch.childId).text).advancesEm, DEFAULT_CONFIG.text.branch.stretch);
    const glyphs = layoutSceneBranchLabel(scene, DEFAULT_CONFIG, DEFAULT_EXTENSIONS, run, branch)?.glyphs ?? [];
    return { branch, glyphs };
  });
  const allGlyphs: PlacedGlyph[] = labels.flatMap((label) => [...label.glyphs]);

  it('WHEN every branch label is laid out THEN each label keeps at least one glyph', () => {
    expect(labels.filter((label) => label.glyphs.length === 0).map((label) => label.branch.childId)).toEqual([]);
  });

  it('WHEN every branch label is laid out THEN every glyph position and angle is finite', () => {
    const finite = allGlyphs.every((g) => [g.center.x, g.center.y, g.angle].every(Number.isFinite));
    expect(finite).toBe(true);
  });

  it('WHEN every branch label is laid out THEN no glyph center sits inside its parent or child node', () => {
    const insideANode = labels.filter(({ branch, glyphs }) =>
      [branch.parentId, branch.childId].some((id) => {
        const box = { center: scene.positions.get(id) ?? { x: 0, y: 0 }, size: scene.sizes.get(id) ?? { width: 0, height: 0 } };
        return glyphs.some((g) => DEFAULT_EXTENSIONS.nodeShape.contains(box, g.center));
      }),
    );
    expect(insideANode.map((label) => label.branch.childId)).toEqual([]);
  });

  it('WHEN every branch label is laid out THEN every glyph reads upright on both sides', () => {
    expect(allGlyphs.filter((g) => Math.cos(g.angle) < 0)).toEqual([]);
  });
});

/** A canvas context that only records what was called: enough to tell outline painting from `fillText`. */
function recordingContext(): { ctx: CanvasRenderingContext2D; calls: { method: string; args: unknown[] }[] } {
  const calls: { method: string; args: unknown[] }[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_target, method: string) => (...args: unknown[]) => {
      calls.push({ method, args });
      return method === 'measureText' ? { width: 10 } : undefined;
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('GIVEN a map whose only child label has CJK characters the vendored Kalam font lacks', () => {
  const data: MindmapData = [
    { id: 'root', parentId: null, text: 'Root' },
    { id: 'jp', parentId: 'root', text: '\u65e5\u672c' },
  ];
  const scene = buildScene(data, DEFAULT_CONFIG, DEFAULT_EXTENSIONS);
  const font = LoadedFont.parse(vendoredKalamBytes());
  const { ctx, calls } = recordingContext();
  drawLabels(ctx, scene, DEFAULT_CONFIG, DEFAULT_EXTENSIONS, { node: font, branch: font }, { nodeFontFamily: '"kalam", cursive' });

  it('WHEN labels are drawn THEN the node label is drawn with fillText so every character shows', () => {
    expect(calls.filter((c) => c.method === 'fillText').map((c) => c.args[0])).toEqual(['\u65e5\u672c']);
  });

  it('WHEN labels are drawn THEN only the root label is inked from outlines: the CJK branch label is skipped', () => {
    expect(calls.filter((c) => c.method === 'fill')).toHaveLength(1);
  });
});
