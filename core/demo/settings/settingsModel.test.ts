import { DEFAULT_CONFIG, type MindmapConfig } from 'organic-mindmap';
import { valueAt, withValueAt } from './configPath';
import { formatNumber, humanize, isAtDefaults, settingSections, type SettingField } from './settingsModel';

function allFields(config: MindmapConfig = DEFAULT_CONFIG): SettingField[] {
  return settingSections(config).flatMap((section) => section.groups.flatMap((group) => group.fields));
}

function field(id: string): SettingField {
  const found = allFields().find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No field id=[${id}]`);
  return found;
}

/** Every leaf of a plain-data object, as dotted paths (arrays descended, like the panel does). */
function leafIds(value: unknown, prefix: string): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => leafIds(child, prefix === '' ? key : `${prefix}.${key}`));
}

describe('GIVEN the settings derived from the default config', () => {
  it('WHEN listing fields THEN every config leaf has exactly one control', () => {
    expect(allFields().map((candidate) => candidate.id).sort()).toEqual(leafIds(DEFAULT_CONFIG, '').sort());
  });

  it('WHEN listing sections THEN they follow the top-level config keys', () => {
    expect(settingSections(DEFAULT_CONFIG).map((section) => section.key)).toEqual(['theme', 'node', 'branch', 'text', 'layout', 'interaction']);
  });

  it('WHEN looking at the reparent confirmation THEN it is a toggle the user can turn back on', () => {
    expect(field('interaction.confirmReparent').kind).toBe('toggle');
  });

  it('WHEN looking at the background THEN it is a color picker', () => {
    expect(field('theme.color.background').kind).toBe('color');
  });

  it('WHEN looking at a non-hex color (the label outline is rgba) THEN it is a text field', () => {
    expect(field('theme.color.textOutline').kind).toBe('text');
  });

  it('WHEN looking at a font URL THEN it is a text field', () => {
    expect(field('text.node.url').kind).toBe('text');
  });

  it('WHEN looking at bold THEN it is a toggle', () => {
    expect(field('text.branch.bold').kind).toBe('toggle');
  });

  it('WHEN looking at the layout type THEN it is a choice of the known layout types', () => {
    expect(field('layout.type')).toMatchObject({ kind: 'choice', options: ['bilateral'] });
  });

  it('WHEN reading the side order field THEN it is a choice over the known side orders', () => {
    expect(field('layout.sideOrder')).toMatchObject({ kind: 'choice', options: ['alternating', 'clockwise'] });
  });

  it('WHEN looking at the depth scale THEN its slider allows children larger than parents (spec R4)', () => {
    const depthScale = field('node.depthScale');
    expect(depthScale.kind === 'number' && depthScale.range.max > 1).toBe(true);
  });

  it('WHEN checking every numeric field THEN its default lies within its slider range', () => {
    const outOfRange = allFields().filter((candidate) => {
      if (candidate.kind !== 'number') return false;
      const value = valueAt(DEFAULT_CONFIG, candidate.path) as number;
      return value < candidate.range.min || value > candidate.range.max;
    });
    expect(outOfRange.map((candidate) => candidate.id)).toEqual([]);
  });

  it('WHEN looking at palette entries THEN their groups are numbered from 1', () => {
    const titles = settingSections(DEFAULT_CONFIG)[0]?.groups.map((group) => group.title);
    expect(titles).toContain('Palette 1');
  });

  it("WHEN looking at a section's own fields THEN their group has no heading", () => {
    const nodeSection = settingSections(DEFAULT_CONFIG).find((section) => section.key === 'node');
    expect(nodeSection?.groups.find((group) => group.id === 'node')?.title).toBe('');
  });
});

describe('GIVEN a config with a numeric field that has no slider range', () => {
  it('WHEN deriving the settings THEN it fails naming the field', () => {
    const config = { ...DEFAULT_CONFIG, branch: { ...DEFAULT_CONFIG.branch, unknownKnob: 1 } } as MindmapConfig;
    expect(() => settingSections(config)).toThrow('branch.unknownKnob');
  });
});

describe('GIVEN a camelCase config key', () => {
  it('WHEN it ends in a unit THEN the unit moves into brackets', () => {
    expect(humanize('letterSpacingEm')).toBe('Letter spacing (em)');
  });

  it('WHEN it has no unit THEN it becomes a sentence-case label', () => {
    expect(humanize('widthPerLevel')).toBe('Width per level');
  });
});

describe('GIVEN a slider step', () => {
  it('WHEN formatting a value THEN it shows as many decimals as the step', () => {
    expect(formatNumber(0.5, 0.005)).toBe('0.500');
  });

  it('WHEN the step is whole THEN no decimals are shown', () => {
    expect(formatNumber(120, 1)).toBe('120');
  });
});

describe('GIVEN settings equal to the defaults but not the same object (e.g. loaded from storage)', () => {
  it('WHEN checking THEN they are at the defaults', () => {
    expect(isAtDefaults(structuredClone(DEFAULT_CONFIG))).toBe(true);
  });
});

describe('GIVEN settings with one palette color changed', () => {
  it('WHEN checking THEN they are not at the defaults', () => {
    expect(isAtDefaults(withValueAt(DEFAULT_CONFIG, ['theme', 'color', 'palette', 2, 'fill'], '#000000'))).toBe(false);
  });
});
