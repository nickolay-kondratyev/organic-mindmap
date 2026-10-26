import { DEFAULT_CONFIG } from 'natural-mindmap';
import { MissingConfigPathError, valueAt, withValueAt } from './configPath';

describe('GIVEN the default config', () => {
  it('WHEN reading a nested path THEN its value is returned', () => {
    expect(valueAt(DEFAULT_CONFIG, ['branch', 'taper'])).toBe(DEFAULT_CONFIG.branch.taper);
  });

  it('WHEN reading a path through the palette THEN the array entry is used', () => {
    expect(valueAt(DEFAULT_CONFIG, ['theme', 'color', 'palette', 1, 'fill'])).toBe(DEFAULT_CONFIG.theme.color.palette[1]?.fill);
  });

  it('WHEN reading a path that does not exist THEN it throws', () => {
    expect(() => valueAt(DEFAULT_CONFIG, ['branch', 'nope'])).toThrow(MissingConfigPathError);
  });

  it('WHEN writing a nested value THEN the copy has the new value', () => {
    expect(withValueAt(DEFAULT_CONFIG, ['branch', 'taper'], 0.5).branch.taper).toBe(0.5);
  });

  it('WHEN writing a nested value THEN the original is not mutated', () => {
    const before = structuredClone(DEFAULT_CONFIG);
    withValueAt(DEFAULT_CONFIG, ['theme', 'color', 'palette', 0, 'fill'], '#000000');
    expect(DEFAULT_CONFIG).toEqual(before);
  });

  it('WHEN writing a palette entry THEN the palette stays an array', () => {
    const palette = withValueAt(DEFAULT_CONFIG, ['theme', 'color', 'palette', 0, 'fill'], '#000000').theme.color.palette;
    expect(Array.isArray(palette)).toBe(true);
  });

  it('WHEN writing a palette entry THEN the other entries are unchanged', () => {
    const palette = withValueAt(DEFAULT_CONFIG, ['theme', 'color', 'palette', 0, 'fill'], '#000000').theme.color.palette;
    expect(palette.slice(1)).toEqual(DEFAULT_CONFIG.theme.color.palette.slice(1));
  });

  it('WHEN writing one section THEN untouched sections are shared, not copied', () => {
    expect(withValueAt(DEFAULT_CONFIG, ['branch', 'taper'], 0.5).layout).toBe(DEFAULT_CONFIG.layout);
  });

  it('WHEN writing a path that does not exist THEN it throws instead of adding a key', () => {
    expect(() => withValueAt(DEFAULT_CONFIG, ['branch', 'nope'], 1)).toThrow(MissingConfigPathError);
  });

  it('WHEN writing past the end of the palette THEN it throws', () => {
    expect(() => withValueAt(DEFAULT_CONFIG, ['theme', 'color', 'palette', 99, 'fill'], '#000000')).toThrow(MissingConfigPathError);
  });
});
