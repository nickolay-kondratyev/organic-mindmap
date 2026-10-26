import type { BranchConfig } from '../config/config';
import { DEFAULT_CONFIG } from '../config/config';
import type { MindmapNode, NodeId, NodeSize, Point } from '../model/node';
import { buildTree } from '../model/tree';
import { buildBranches, widthAtDepth, type BranchGeometryInput } from './branchGeometry';
import type { Branch } from './branchPath';

const UNIFORM_SIZE: NodeSize = { width: 40, height: 20 };
/** No taper so widths stay constant along the limb: makes overlap arithmetic in the tests obvious. */
const CONSTANT_WIDTH: BranchConfig = { rootWidth: 20, widthPerLevel: 1, taper: 1, asymmetry: 0 };

interface PlacedNode {
  readonly node: MindmapNode;
  readonly at: Point;
  readonly size?: NodeSize;
}

function inputFrom(placed: readonly PlacedNode[], config: BranchConfig = DEFAULT_CONFIG.branch): BranchGeometryInput {
  const tree = buildTree(placed.map((p) => p.node));
  const positions = new Map<NodeId, Point>(placed.map((p) => [p.node.id, p.at]));
  const sizes = new Map<NodeId, NodeSize>(placed.map((p) => [p.node.id, p.size ?? UNIFORM_SIZE]));
  return { tree, positions, sizes, config };
}

function branchTo(branches: readonly Branch[], childId: NodeId): Branch {
  const branch = branches.find((b) => b.childId === childId);
  if (branch === undefined) throw new Error(`no branch to [${childId}]`);
  return branch;
}

function pointAtFraction(branch: Branch, fraction: number): Point {
  return branch.path.sampleAt(branch.path.length * fraction).point;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('buildBranches', () => {
  describe('GIVEN a root with two right-side children above and below it', () => {
    const input = inputFrom([
      { node: { id: 'root', parentId: null, text: 'R' }, at: { x: 0, y: 0 } },
      { node: { id: 'up', parentId: 'root', text: 'U', side: 'right' }, at: { x: 300, y: -120 } },
      { node: { id: 'down', parentId: 'root', text: 'D', side: 'right' }, at: { x: 300, y: 120 } },
    ]);
    const branches = buildBranches(input);

    it('WHEN built THEN each branch runs from the parent center to the child center', () => {
      const up = branchTo(branches, 'up');
      expect([pointAtFraction(up, 0), pointAtFraction(up, 1)]).toEqual([
        { x: 0, y: 0 },
        { x: 300, y: -120 },
      ]);
    });

    it('WHEN leaving the root THEN the tangent is horizontal', () => {
      expect(branchTo(branches, 'up').path.sampleAt(0).tangent).toEqual({ x: 1, y: 0 });
    });

    it('WHEN arriving at the child THEN the tangent is horizontal again', () => {
      const up = branchTo(branches, 'up');
      expect(Math.abs(up.path.sampleAt(up.path.length).tangent.y)).toBeLessThan(1e-6);
    });

    it('WHEN siblings fork THEN they stay together close to the parent and diverge later (soft Y)', () => {
      const up = branchTo(branches, 'up');
      const down = branchTo(branches, 'down');
      const nearParent = distance(pointAtFraction(up, 0.1), pointAtFraction(down, 0.1));
      const midway = distance(pointAtFraction(up, 0.5), pointAtFraction(down, 0.5));
      expect(nearParent).toBeLessThan(midway / 4);
    });

    it('WHEN built twice from the same input THEN the geometry is identical (deterministic)', () => {
      const again = buildBranches(input);
      const sample = (list: readonly Branch[]) => list.map((b) => [b.childId, pointAtFraction(b, 0.37)]);
      expect(sample(again)).toEqual(sample(branches));
    });
  });

  describe('GIVEN a wide parent whose two children sit close beyond its rim', () => {
    const PARENT_HALF_WIDTH = 100;
    const CHILD_X = 260;
    const CHILD_HALF_SPREAD = 80;
    const input = inputFrom([
      { node: { id: 'p', parentId: null, text: 'P' }, at: { x: 0, y: 0 }, size: { width: PARENT_HALF_WIDTH * 2, height: 50 } },
      { node: { id: 'up', parentId: 'p', text: 'U', side: 'right' }, at: { x: CHILD_X, y: -CHILD_HALF_SPREAD } },
      { node: { id: 'down', parentId: 'p', text: 'D', side: 'right' }, at: { x: CHILD_X, y: CHILD_HALF_SPREAD } },
    ]);
    const branches = buildBranches(input);
    /** y of the first centerline sample at or past the parent's right rim. */
    function yAtRim(branch: Branch): number {
      const STEPS = 1000;
      for (let i = 0; i <= STEPS; i++) {
        const point = pointAtFraction(branch, i / STEPS);
        if (point.x >= PARENT_HALF_WIDTH) return point.y;
      }
      throw new Error('branch never crosses the parent rim');
    }

    it('WHEN the limbs cross the parent rim THEN they are still bundled: the fork is measured from the rim, not the center', () => {
      // Measured from the center, the fork (0.38 of the 260 px reach) would sit inside the box and the siblings
      // would already be about a third apart at the rim; from the rim they stay within a quarter.
      const separationAtRim = Math.abs(yAtRim(branchTo(branches, 'up')) - yAtRim(branchTo(branches, 'down')));
      expect(separationAtRim).toBeLessThan((2 * CHILD_HALF_SPREAD) / 4);
    });
  });

  describe('GIVEN a three-level chain', () => {
    const input = inputFrom([
      { node: { id: 'root', parentId: null, text: 'R' }, at: { x: 0, y: 0 } },
      { node: { id: 'a', parentId: 'root', text: 'A' }, at: { x: 300, y: 0 } },
      { node: { id: 'a1', parentId: 'a', text: 'A1' }, at: { x: 600, y: 0 } },
    ]);
    const branches = buildBranches(input);
    const { rootWidth, widthPerLevel, taper } = DEFAULT_CONFIG.branch;

    it('WHEN a branch leaves the root THEN it starts at the configured root width', () => {
      expect(branchTo(branches, 'a').width.start).toBe(rootWidth);
    });

    it('WHEN a branch is one level deeper THEN its start width is scaled by widthPerLevel', () => {
      expect(branchTo(branches, 'a1').width.start).toBeCloseTo(rootWidth * widthPerLevel, 9);
    });

    it('WHEN a branch ends THEN its end width is the taper fraction of its start', () => {
      expect(branchTo(branches, 'a').width.end).toBeCloseTo(rootWidth * taper, 9);
    });
  });

  describe('GIVEN an unrelated node sitting right on the straight line between parent and child', () => {
    const obstacle: PlacedNode = {
      node: { id: 'other', parentId: 'root', text: 'O', side: 'left' },
      at: { x: 300, y: 0 },
      size: { width: 80, height: 40 },
    };
    const input = inputFrom([
      { node: { id: 'root', parentId: null, text: 'R' }, at: { x: 0, y: 0 } },
      { node: { id: 'far', parentId: 'root', text: 'F', side: 'right' }, at: { x: 600, y: 0 } },
      obstacle,
    ]);
    const far = branchTo(buildBranches(input), 'far');

    it('WHEN routed THEN no point of the branch centerline lies inside the obstacle box', () => {
      const halfW = (obstacle.size as NodeSize).width / 2;
      const halfH = (obstacle.size as NodeSize).height / 2;
      const samples = Array.from({ length: 41 }, (_, i) => pointAtFraction(far, i / 40));
      const inside = samples.filter(
        (p) => Math.abs(p.x - obstacle.at.x) <= halfW && Math.abs(p.y - obstacle.at.y) <= halfH,
      );
      expect(inside).toEqual([]);
    });
  });

  describe('GIVEN an unrelated node right beside a parent, grazing its limb only where the limb leaves the parent', () => {
    // Below the limb's start and within its clearance, but not covering the parent's center.
    const grazing: PlacedNode = { node: { id: 'graze', parentId: 'root', text: 'G' }, at: { x: 310, y: 14 } };
    const input = inputFrom(
      [
        { node: { id: 'root', parentId: null, text: 'R' }, at: { x: 0, y: 0 } },
        { node: { id: 'p', parentId: 'root', text: 'P', side: 'right' }, at: { x: 300, y: 0 } },
        { node: { id: 'c', parentId: 'p', text: 'C' }, at: { x: 600, y: 0 } },
        grazing,
      ],
      CONSTANT_WIDTH,
    );
    const limb = branchTo(buildBranches(input), 'c');

    it('WHEN routed THEN the limb bends less than the obstacle is tall (no bounce)', () => {
      const unroutedMidY = 0;
      expect(Math.abs(pointAtFraction(limb, 0.5).y - unroutedMidY)).toBeLessThan(UNIFORM_SIZE.height);
    });
  });

  describe('GIVEN two limbs from different parents running too close to each other', () => {
    const SMALL: NodeSize = { width: 10, height: 10 };
    const placed: PlacedNode[] = [
      { node: { id: 'root', parentId: null, text: 'R' }, at: { x: -300, y: 0 }, size: SMALL },
      { node: { id: 'pa', parentId: 'root', text: 'PA', side: 'right' }, at: { x: 0, y: -8 }, size: SMALL },
      { node: { id: 'pb', parentId: 'root', text: 'PB', side: 'right' }, at: { x: 0, y: 8 }, size: SMALL },
      { node: { id: 'ca', parentId: 'pa', text: 'CA' }, at: { x: 400, y: -8 }, size: SMALL },
      { node: { id: 'cb', parentId: 'pb', text: 'CB' }, at: { x: 400, y: 8 }, size: SMALL },
    ];
    const branches = buildBranches(inputFrom(placed, CONSTANT_WIDTH));
    const a = branchTo(branches, 'ca');
    const b = branchTo(branches, 'cb');

    it('WHEN separated THEN their midpoints are at least a full limb width apart', () => {
      expect(distance(pointAtFraction(a, 0.5), pointAtFraction(b, 0.5))).toBeGreaterThanOrEqual(CONSTANT_WIDTH.rootWidth);
    });

    it('WHEN separated THEN the end points are untouched (still center to center)', () => {
      expect([pointAtFraction(a, 1), pointAtFraction(b, 1)]).toEqual([
        { x: 400, y: -8 },
        { x: 400, y: 8 },
      ]);
    });
  });
});

describe('widthAtDepth', () => {
  it('WHEN going one level deeper THEN start width shrinks by widthPerLevel', () => {
    const config: BranchConfig = { rootWidth: 100, widthPerLevel: 0.5, taper: 0.1, asymmetry: 0 };
    expect([widthAtDepth(1, config).start, widthAtDepth(2, config).start, widthAtDepth(3, config).start]).toEqual([
      100, 50, 25,
    ]);
  });
});
