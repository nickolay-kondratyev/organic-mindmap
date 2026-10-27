import { DEFAULT_CONFIG, type InteractionConfig } from '../config/config';
import type { MindmapData, NodeId, NodeSize, Point } from '../model/node';
import { buildTree } from '../model/tree';
import { editorAllowed, shownHandles, type HandleVisibility } from './editAffordances';
import type { HitScene } from './hitTest';

const NODE_SIZE: NodeSize = { width: 100, height: 40 };
const DEFAULTS = DEFAULT_CONFIG.interaction;
const MOVE_ONLY: InteractionConfig = { ...DEFAULTS, allowAdd: false, allowRename: false, allowDelete: false };

// GIVEN a root with one right child `r`
const data: MindmapData = [
  { id: 'root', parentId: null, text: 'ROOT' },
  { id: 'r', parentId: 'root', text: 'R', side: 'right' },
];
const scene: HitScene = {
  tree: buildTree(data),
  positions: new Map<NodeId, Point>([
    ['root', { x: 0, y: 0 }],
    ['r', { x: 300, y: 0 }],
  ]),
  sizes: new Map(data.map((node) => [node.id, NODE_SIZE])),
};
const HOVERING_R: HandleVisibility = { hoveredNodeId: 'r', busy: false, interaction: DEFAULTS };

describe('shownHandles', () => {
  it('WHEN a node is hovered with default config THEN its "+" shows on both sides', () => {
    expect(shownHandles(scene, HOVERING_R).map((handle) => handle.side)).toEqual(['left', 'right']);
  });

  it('WHEN adding is switched off THEN no "+" shows', () => {
    expect(shownHandles(scene, { ...HOVERING_R, interaction: { ...DEFAULTS, allowAdd: false } })).toEqual([]);
  });

  it('WHEN the map is busy (drag or pending edit) THEN no buttons show', () => {
    expect(shownHandles(scene, { ...HOVERING_R, busy: true })).toEqual([]);
  });

  it('WHEN nothing is hovered THEN no buttons show', () => {
    expect(shownHandles(scene, { ...HOVERING_R, hoveredNodeId: null })).toEqual([]);
  });
});

describe('editorAllowed', () => {
  it('GIVEN default config WHEN asked about rename THEN the editor may open', () => {
    expect(editorAllowed(DEFAULTS, 'rename')).toBe(true);
  });

  it('GIVEN default config WHEN asked about add THEN the editor may open', () => {
    expect(editorAllowed(DEFAULTS, 'add')).toBe(true);
  });

  it('GIVEN a move-only map WHEN asked about rename THEN the editor does not open', () => {
    expect(editorAllowed(MOVE_ONLY, 'rename')).toBe(false);
  });

  it('GIVEN a move-only map WHEN asked about add THEN the editor does not open', () => {
    expect(editorAllowed(MOVE_ONLY, 'add')).toBe(false);
  });

  it('GIVEN only renaming switched off WHEN asked about add THEN the editor may still open', () => {
    expect(editorAllowed({ ...DEFAULTS, allowRename: false }, 'add')).toBe(true);
  });
});
