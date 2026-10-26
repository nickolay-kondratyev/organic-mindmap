import { buildTree } from '../model/tree';
import { resolveNodeSizes } from './nodeSizeResolver';
import type { NodeSizeConfig } from '../config/config';

describe('resolveNodeSizes', () => {
  // GIVEN a three-level chain and a config that halves per depth with a floor
  const config: NodeSizeConfig = { rootSize: { width: 100, height: 50 }, depthScale: 0.5, minScale: 0.2 };
  const tree = buildTree([
    { id: 'root', parentId: null, text: 'R' },
    { id: 'a', parentId: 'root', text: 'A' },
    { id: 'b', parentId: 'a', text: 'B' },
    { id: 'c', parentId: 'b', text: 'C' },
    { id: 'custom', parentId: 'c', text: 'X', size: { width: 7, height: 3 } },
  ]);
  const sizes = resolveNodeSizes(tree, config);

  it('WHEN resolving THEN the root gets the configured root size', () => {
    expect(sizes.get('root')).toEqual({ width: 100, height: 50 });
  });

  it('WHEN going one level deeper THEN size shrinks by depthScale', () => {
    expect(sizes.get('a')).toEqual({ width: 50, height: 25 });
  });

  it('WHEN depth would shrink below minScale THEN size is clamped at minScale', () => {
    expect(sizes.get('c')).toEqual({ width: 20, height: 10 });
  });

  it('WHEN a node carries an explicit size THEN that size overrides the default', () => {
    expect(sizes.get('custom')).toEqual({ width: 7, height: 3 });
  });
});
