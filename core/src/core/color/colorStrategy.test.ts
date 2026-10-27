import { buildTree } from '../model/tree';
import { parentDerivedColorStrategy } from './colorStrategy';
import type { ThemeConfig } from '../config/theme';

describe('parentDerivedColorStrategy', () => {
  // GIVEN a two-color palette and a map with two first-level nodes, one with an explicit colorIndex
  const theme: ThemeConfig = {
    color: {
      background: '#000',
      root: { fill: '#r', outline: '#ro', text: '#fff' },
      nodeText: '#fff',
      branchText: '#fff',
      textOutline: '#000',
      link: '#00f',
      highlight: '#fff',
      palette: [
        { fill: '#p0', outline: '#o0' },
        { fill: '#p1', outline: '#o1' },
      ],
    },
  };
  const tree = buildTree([
    { id: 'root', parentId: null, text: 'R' },
    { id: 'a', parentId: 'root', text: 'A' },
    { id: 'a1', parentId: 'a', text: 'A1' },
    { id: 'b', parentId: 'root', text: 'B', colorIndex: 0 },
    { id: 'c', parentId: 'root', text: 'C' },
  ]);
  const colors = parentDerivedColorStrategy.resolve(tree, theme);

  it('WHEN resolving THEN the root uses the theme root colors', () => {
    expect(colors.get('root')).toEqual({ fill: '#r', outline: '#ro' });
  });

  it('WHEN a first-level node has no colorIndex THEN it takes its sibling position in the palette', () => {
    expect(colors.get('a')).toEqual({ fill: '#p0', outline: '#o0' });
  });

  it('WHEN a first-level node has an explicit colorIndex THEN that palette entry is used', () => {
    expect(colors.get('b')).toEqual({ fill: '#p0', outline: '#o0' });
  });

  it('WHEN a descendant is resolved THEN it inherits its first-level ancestor color', () => {
    expect(colors.get('a1')).toEqual(colors.get('a'));
  });

  it('WHEN there are more first-level nodes than palette entries THEN the palette wraps around', () => {
    expect(colors.get('c')).toEqual({ fill: '#p0', outline: '#o0' });
  });
});
