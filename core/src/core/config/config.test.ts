import { DEFAULT_CONFIG, resolveConfig } from './config';

describe('resolveConfig', () => {
  it('GIVEN no user config WHEN resolving THEN defaults are returned', () => {
    expect(resolveConfig(undefined)).toEqual(DEFAULT_CONFIG);
  });

  it('GIVEN a nested override WHEN resolving THEN only that leaf changes and siblings keep defaults', () => {
    const resolved = resolveConfig({ theme: { color: { background: '#123456' } } });
    expect(resolved.theme.color).toEqual({ ...DEFAULT_CONFIG.theme.color, background: '#123456' });
  });

  it('GIVEN a palette override WHEN resolving THEN the array is replaced, not merged', () => {
    const palette = [{ fill: '#111111', outline: '#000000' }];
    expect(resolveConfig({ theme: { color: { palette } } }).theme.color.palette).toEqual(palette);
  });

  it('GIVEN an override WHEN resolving THEN the defaults object is not mutated', () => {
    const before = structuredClone(DEFAULT_CONFIG);
    resolveConfig({ branch: { rootWidth: 1 } });
    expect(DEFAULT_CONFIG).toEqual(before);
  });

  it('GIVEN a layout override WHEN resolving THEN the layout type discriminant is preserved', () => {
    expect(resolveConfig({ layout: { type: 'bilateral', horizontalGap: 5 } }).layout.type).toBe('bilateral');
  });
});

describe('resolveConfig text fonts', () => {
  it('GIVEN only a branch font override WHEN resolving THEN the node font keeps its default', () => {
    expect(resolveConfig({ text: { branch: { url: 'https://fonts.test/other.ttf' } } }).text.node.url).toBe(
      DEFAULT_CONFIG.text.node.url,
    );
  });
});
