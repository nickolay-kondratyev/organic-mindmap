import type { MindmapData } from '../model/node';
import { applyEdit } from './applyEdit';

describe('applyEdit', () => {
  // GIVEN root -> a -> a1, root -> b
  const data: MindmapData = [
    { id: 'root', parentId: null, text: 'R' },
    { id: 'a', parentId: 'root', text: 'A' },
    { id: 'a1', parentId: 'a', text: 'A1' },
    { id: 'b', parentId: 'root', text: 'B' },
  ];
  const NEW_ID = 'new';

  it('WHEN moving a node THEN only its parent changes', () => {
    const result = applyEdit(data, { type: 'move', nodeId: 'a', newParentId: 'b' }, NEW_ID);
    expect(result.find((n) => n.id === 'a')).toEqual({ id: 'a', parentId: 'b', text: 'A' });
  });

  it('WHEN moving a node THEN its children stay attached to it', () => {
    const result = applyEdit(data, { type: 'move', nodeId: 'a', newParentId: 'b' }, NEW_ID);
    expect(result.find((n) => n.id === 'a1')?.parentId).toBe('a');
  });

  it('WHEN renaming THEN the node gets the new text', () => {
    const result = applyEdit(data, { type: 'rename', nodeId: 'b', text: 'Bee' }, NEW_ID);
    expect(result.find((n) => n.id === 'b')?.text).toBe('Bee');
  });

  it('WHEN adding THEN a child with the given id and text is appended', () => {
    const result = applyEdit(data, { type: 'add', parentId: 'a', text: 'New' }, NEW_ID);
    expect(result.at(-1)).toEqual({ id: NEW_ID, parentId: 'a', text: 'New' });
  });

  it('WHEN adding with a side THEN the new node carries that side', () => {
    const result = applyEdit(data, { type: 'add', parentId: 'root', text: 'New', side: 'left' }, NEW_ID);
    expect(result.at(-1)?.side).toBe('left');
  });

  it('WHEN deleting THEN the node and its subtree are removed', () => {
    const result = applyEdit(data, { type: 'delete', nodeId: 'a' }, NEW_ID);
    expect(result.map((n) => n.id)).toEqual(['root', 'b']);
  });

  it('WHEN applying any edit THEN the input data is not mutated', () => {
    const snapshot = JSON.stringify(data);
    applyEdit(data, { type: 'rename', nodeId: 'a', text: 'Changed' }, NEW_ID);
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});
