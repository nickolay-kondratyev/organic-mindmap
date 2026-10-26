import { StraightPath } from '../geometry/branchPath';
import { CircularArcPath } from '../../../test-support/circularArcPath';
import { placeGlyphs, readsReversed } from './glyphPlacement';

describe('placeGlyphs', () => {
  describe('GIVEN a straight path along +x', () => {
    const path = new StraightPath({ x: 0, y: 0 }, { x: 100, y: 0 });

    it('WHEN placing two 10px glyphs with a 2px gap THEN each sits at the middle of its advance', () => {
      const centers = placeGlyphs(path, { startArc: 20, reversed: false }, [10, 10], 2).map((g) => g.center.x);
      expect(centers).toEqual([25, 37]);
    });

    it('WHEN reading reversed THEN glyphs walk towards smaller arc lengths', () => {
      const centers = placeGlyphs(path, { startArc: 80, reversed: true }, [10, 10], 2).map((g) => g.center.x);
      expect(centers).toEqual([75, 63]);
    });

    it('WHEN reading reversed THEN glyphs are turned half a turn', () => {
      expect(placeGlyphs(path, { startArc: 80, reversed: true }, [10], 0)[0]?.angle).toBeCloseTo(Math.PI);
    });
  });

  describe('GIVEN a quarter circle curving from +x to +y', () => {
    // Radius 100 around the origin from angle -90deg to 0deg: starts heading +x, ends heading +y.
    const path = new CircularArcPath({ x: 0, y: 0 }, 100, -Math.PI / 2, Math.PI / 2);

    it('WHEN placing glyphs THEN each is rotated to the local tangent', () => {
      const glyph = placeGlyphs(path, { startArc: path.length / 2 - 5, reversed: false }, [10], 0)[0];
      expect(glyph?.angle).toBeCloseTo(Math.PI / 4);
    });

    it('WHEN placing glyphs THEN later glyphs turn further than earlier ones', () => {
      const [first, second] = placeGlyphs(path, { startArc: 0, reversed: false }, [20, 20], 0);
      expect((second?.angle ?? 0) > (first?.angle ?? 0)).toBe(true);
    });
  });
});

describe('readsReversed', () => {
  it('GIVEN a path heading right WHEN checked THEN text reads forward', () => {
    expect(readsReversed(new StraightPath({ x: 0, y: 0 }, { x: 100, y: 20 }), { start: 0, end: 100 })).toBe(false);
  });

  it('GIVEN a left-side branch heading left WHEN checked THEN text is flipped', () => {
    expect(readsReversed(new StraightPath({ x: 0, y: 0 }, { x: -100, y: 20 }), { start: 0, end: 100 })).toBe(true);
  });
});
