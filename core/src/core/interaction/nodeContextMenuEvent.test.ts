import { PENDING_NODE_ID } from '../edit/editSession';
import type { NodePositions } from '../layout/layoutTypes';
import type { MindmapData, NodeId, NodeSize, Point } from '../model/node';
import { buildTree } from '../model/tree';
import { ellipseShape } from '../shape/nodeShape';
import type { HitScene } from './hitTest';
import { contextMenuNodeId } from './nodeContextMenuEvent';

const NODE_SIZE: NodeSize = { width: 100, height: 40 };

describe('GIVEN a root, a node `a` to its right and a pending add preview below `a`', () => {
  const data: MindmapData = [
    { id: 'root', parentId: null, text: 'ROOT' },
    { id: 'a', parentId: 'root', text: 'A', side: 'right' },
    { id: PENDING_NODE_ID, parentId: 'a', text: 'NEW' },
  ];
  const positions: NodePositions = new Map<NodeId, Point>([
    ['root', { x: 0, y: 0 }],
    ['a', { x: 300, y: 0 }],
    [PENDING_NODE_ID, { x: 300, y: 200 }],
  ]);
  const scene: HitScene = { tree: buildTree(data), positions, sizes: new Map(data.map((node) => [node.id, NODE_SIZE])) };

  it('WHEN a node is right-clicked THEN that node is reported', () => {
    expect(contextMenuNodeId(scene, { x: 300, y: 5 }, ellipseShape)).toBe('a');
  });

  it('WHEN the root is right-clicked THEN the root is reported', () => {
    expect(contextMenuNodeId(scene, { x: 0, y: 0 }, ellipseShape)).toBe('root');
  });

  it('WHEN empty canvas is right-clicked THEN nothing is reported', () => {
    expect(contextMenuNodeId(scene, { x: 150, y: -200 }, ellipseShape)).toBeNull();
  });

  it('WHEN the pending preview node is right-clicked THEN nothing is reported', () => {
    expect(contextMenuNodeId(scene, { x: 300, y: 200 }, ellipseShape)).toBeNull();
  });
});
