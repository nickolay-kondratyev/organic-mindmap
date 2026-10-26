import { DEFAULT_CONFIG, type MindmapConfig } from './config';
import { restoreConfig } from './restoreConfig';

const DEFAULT_PALETTE = DEFAULT_CONFIG.theme.color.palette;

const SAVED: MindmapConfig = {
  ...DEFAULT_CONFIG,
  branch: { ...DEFAULT_CONFIG.branch, taper: 0.5 },
  theme: { color: { ...DEFAULT_CONFIG.theme.color, background: '#123456' } },
};

describe('restoreConfig', () => {
  it('GIVEN an unknown side order WHEN restoring THEN it falls back to the default side order', () => {
    expect(restoreConfig({ layout: { sideOrder: 'spiral', horizontalGap: 50 } }).layout).toEqual({
      ...DEFAULT_CONFIG.layout,
      horizontalGap: 50,
    });
  });

  it('GIVEN nothing stored WHEN restoring THEN the defaults are returned', () => {
    expect(restoreConfig(undefined)).toBe(DEFAULT_CONFIG);
  });

  it('GIVEN a fully saved config WHEN restoring THEN it comes back unchanged', () => {
    expect(restoreConfig(structuredClone(SAVED))).toEqual(SAVED);
  });

  it('GIVEN only one stored leaf WHEN restoring THEN that leaf is used and the rest are defaults', () => {
    expect(restoreConfig({ branch: { taper: 0.5 } })).toEqual({ ...DEFAULT_CONFIG, branch: { ...DEFAULT_CONFIG.branch, taper: 0.5 } });
  });

  it('GIVEN a leaf of the wrong type WHEN restoring THEN that leaf falls back to its default', () => {
    expect(restoreConfig({ branch: { taper: 'thin' } }).branch.taper).toBe(DEFAULT_CONFIG.branch.taper);
  });

  it('GIVEN a leaf of the wrong type WHEN restoring THEN its valid siblings are kept', () => {
    expect(restoreConfig({ branch: { taper: 'thin', rootWidth: 30 } }).branch.rootWidth).toBe(30);
  });

  it('GIVEN a null number WHEN restoring THEN it falls back to its default', () => {
    expect(restoreConfig({ node: { minScale: null } }).node.minScale).toBe(DEFAULT_CONFIG.node.minScale);
  });

  it('GIVEN a non-finite number WHEN restoring THEN it falls back to its default', () => {
    expect(restoreConfig({ node: { minScale: Number.POSITIVE_INFINITY } }).node.minScale).toBe(DEFAULT_CONFIG.node.minScale);
  });

  it('GIVEN a section stored as a non-object WHEN restoring THEN that section is the default', () => {
    expect(restoreConfig({ node: 'big' }).node).toEqual(DEFAULT_CONFIG.node);
  });

  it.each([['a string', 'garbage'], ['a number', 42], ['an array', [1, 2]], ['null', null]])(
    'GIVEN %s stored WHEN restoring THEN the defaults are returned',
    (_name, stored) => {
      expect(restoreConfig(stored)).toEqual(DEFAULT_CONFIG);
    },
  );

  it('GIVEN keys the config does not have (e.g. from an older version) WHEN restoring THEN they are dropped', () => {
    expect(restoreConfig({ branch: { removedSetting: 3 } }).branch).toEqual(DEFAULT_CONFIG.branch);
  });

  it('GIVEN a valid stored palette WHEN restoring THEN it replaces the default palette', () => {
    const palette = DEFAULT_PALETTE.map((color) => ({ ...color, fill: '#111111' }));
    expect(restoreConfig({ theme: { color: { palette } } }).theme.color.palette).toEqual(palette);
  });

  it('GIVEN palette entries with keys the config does not have WHEN restoring THEN those keys are dropped', () => {
    const palette = DEFAULT_PALETTE.map((color) => ({ ...color, glow: '#ffffff' }));
    expect(restoreConfig({ theme: { color: { palette } } }).theme.color.palette).toEqual(DEFAULT_PALETTE);
  });

  it('GIVEN a palette with a malformed entry WHEN restoring THEN the default palette is used', () => {
    const palette = DEFAULT_PALETTE.map((color, index) => (index === 1 ? { fill: color.fill } : color));
    expect(restoreConfig({ theme: { color: { palette } } }).theme.color.palette).toBe(DEFAULT_PALETTE);
  });

  it('GIVEN a stored palette of a different length WHEN restoring THEN the default palette is used', () => {
    const palette = [{ fill: '#111111', outline: '#000000' }];
    expect(restoreConfig({ theme: { color: { palette } } }).theme.color.palette).toBe(DEFAULT_PALETTE);
  });

  it('GIVEN an unknown layout type WHEN restoring THEN the default layout is used', () => {
    expect(restoreConfig({ layout: { type: 'radial', horizontalGap: 5 } }).layout).toEqual(DEFAULT_CONFIG.layout);
  });

  it('GIVEN reparent confirmation turned off WHEN restoring THEN it stays off', () => {
    expect(restoreConfig({ interaction: { confirmReparent: false } }).interaction.confirmReparent).toBe(false);
  });

  it('GIVEN settings stored before reparent confirmation existed WHEN restoring THEN confirmation is on', () => {
    expect(restoreConfig({ branch: { taper: 0.5 } }).interaction.confirmReparent).toBe(true);
  });

  it('GIVEN a move-only map (add, rename and delete off) WHEN restoring THEN all three stay off', () => {
    const moveOnly = { ...DEFAULT_CONFIG.interaction, allowAdd: false, allowRename: false, allowDelete: false };
    expect(restoreConfig({ interaction: moveOnly }).interaction).toEqual(moveOnly);
  });

  it('GIVEN reparent confirmation stored as a non-boolean WHEN restoring THEN confirmation is on', () => {
    expect(restoreConfig({ interaction: { confirmReparent: 'no' } }).interaction.confirmReparent).toBe(true);
  });
});
