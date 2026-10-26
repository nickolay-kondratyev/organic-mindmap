import { vendoredKalamBytes } from '../../../test-support/vendoredKalam';
import { DEFAULT_CONFIG, resolveConfig } from '../config/config';
import { DEFAULT_EXTENSIONS } from '../extensions';
import { taperedOutline } from '../geometry/taperedOutline';
import type { MindmapData, NodeId } from '../model/node';
import type { NodeBox } from '../shape/nodeShape';
import { GlyphRun } from '../text/glyphRun';
import { LoadedFont } from '../text/loadedFont';
import { rimToRimSpan, spanLength } from '../text/rimSpan';
import { layoutSceneBranchLabel } from './labelRenderer';
import { buildScene, type Scene } from './scene';

/** A leaf box far larger than any default size, so it dwarfs its parent (spec R4: child may be larger). */
const OVERSIZED_LEAF = { width: 320, height: 120 };
/** Boxes grow with depth instead of shrinking. */
const GROWING_DEPTH_SCALE = 1.3;

const DATA: MindmapData = [
  { id: 'root', parentId: null, text: 'ROOT' },
  { id: 'a', parentId: 'root', text: 'A', side: 'right' },
  { id: 'a1', parentId: 'a', text: 'A one', size: OVERSIZED_LEAF },
  { id: 'a2', parentId: 'a', text: 'A two' },
  { id: 'b', parentId: 'root', text: 'B', side: 'right' },
  { id: 'c', parentId: 'root', text: 'C', side: 'left' },
  { id: 'c1', parentId: 'c', text: 'C one' },
  { id: 'c11', parentId: 'c1', text: 'C one one' },
];

function boxOf(scene: Scene, id: NodeId): NodeBox {
  const center = scene.positions.get(id);
  const size = scene.sizes.get(id);
  if (center === undefined || size === undefined) throw new Error(`missing node [${id}]`);
  return { center, size };
}

function boxesOverlap(scene: Scene, a: NodeId, b: NodeId, padding: number): boolean {
  const pa = scene.positions.get(a);
  const pb = scene.positions.get(b);
  const sa = scene.sizes.get(a);
  const sb = scene.sizes.get(b);
  if (pa === undefined || pb === undefined || sa === undefined || sb === undefined) throw new Error('missing node');
  const overlapX = (sa.width + sb.width) / 2 + padding - Math.abs(pa.x - pb.x);
  const overlapY = (sa.height + sb.height) / 2 + padding - Math.abs(pa.y - pb.y);
  // Floating-point residue of a collision push is not an overlap.
  const EPSILON = 1e-6;
  return overlapX > EPSILON && overlapY > EPSILON;
}

describe('GIVEN a map where children are larger than their parents (per-node size and depthScale > 1)', () => {
  const config = resolveConfig({ node: { depthScale: GROWING_DEPTH_SCALE } });
  const scene = buildScene(DATA, config, DEFAULT_EXTENSIONS);
  const font = LoadedFont.parse(vendoredKalamBytes());

  it('WHEN sizes resolve THEN the oversized leaf really is larger than its parent', () => {
    expect(scene.sizes.get('a1')).toEqual(OVERSIZED_LEAF);
  });

  it('WHEN laid out THEN no two node boxes overlap after collision', () => {
    const ids = scene.tree.nodes.map((node) => node.id);
    const overlapping = ids.flatMap((a, i) =>
      ids.slice(i + 1).filter((b) => boxesOverlap(scene, a, b, config.layout.collisionPadding)).map((b) => `${a}/${b}`),
    );
    expect(overlapping).toEqual([]);
  });

  it('WHEN branches are built THEN every limb has positive, finite widths and length', () => {
    const invalid = scene.branches.filter(
      (b) => !(b.width.start > 0 && b.width.end > 0 && b.path.length > 0) || ![b.width.start, b.width.end, b.path.length].every(Number.isFinite),
    );
    expect(invalid.map((b) => b.childId)).toEqual([]);
  });

  it('WHEN limbs are outlined THEN every outline point is finite', () => {
    const points = scene.branches.flatMap((b) => [...taperedOutline(b, config.branch.asymmetry)]);
    expect(points.filter((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))).toEqual([]);
  });

  it('WHEN rim-to-rim spans are measured THEN none is negative', () => {
    const negative = scene.branches.filter(
      (branch) =>
        spanLength(rimToRimSpan(branch.path, boxOf(scene, branch.parentId), boxOf(scene, branch.childId), DEFAULT_EXTENSIONS.nodeShape)) < 0,
    );
    expect(negative.map((b) => b.childId)).toEqual([]);
  });

  it('WHEN branch labels are laid out THEN every label gets a positive font size and finite glyphs', () => {
    const broken = scene.branches.filter((branch) => {
      const run = new GlyphRun(font.shape(scene.tree.nodeById(branch.childId).text).advancesEm, DEFAULT_CONFIG.text.branch.stretch);
      const layout = layoutSceneBranchLabel(scene, config, DEFAULT_EXTENSIONS, run, branch);
      if (layout === null || !(layout.sizePx > 0)) return true;
      return layout.glyphs.some((g) => ![g.center.x, g.center.y, g.angle].every(Number.isFinite));
    });
    expect(broken.map((b) => b.childId)).toEqual([]);
  });
});
