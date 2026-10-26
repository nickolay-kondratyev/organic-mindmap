import { DEFAULT_CONFIG } from '../config/config';
import type { EditHandler, EditRequest } from '../edit/editRequest';
import { EDIT_BLOCKED_REASON, EditSession, type EditSubmitResult } from '../edit/editSession';
import { DEFAULT_EDIT_HANDLER } from '../edit/inMemoryHost';
import { DEFAULT_EXTENSIONS } from '../extensions';
import type { NodePositions } from '../layout/layoutTypes';
import {
  nodeOffsetsOf,
  overridesFromNodeOffsets,
  type NodeOffset,
  type NodeOffsets,
  type PositionOverrides,
} from '../layout/positionOverrides';
import type { MindmapData, NodeId, Point } from '../model/node';
import { REFERENCE_DATA } from '../model/referenceData';
import { buildTree } from '../model/tree';
import { buildScene, type Scene } from '../render/scene';
import { addDraftRequest, DRAFT_NODE_ID, LocalEditState, type DropScene } from './localEditState';

const DATA: MindmapData = [
  { id: 'root', parentId: null, text: 'R' },
  { id: 'a', parentId: 'root', text: 'A' },
  { id: 'a1', parentId: 'a', text: 'A1' },
  { id: 'b', parentId: 'root', text: 'B' },
];
/** `DATA` after the host confirmed moving `a` (with `a1`) under `b`. */
const A_MOVED_UNDER_B: MindmapData = DATA.map((node) => (node.id === 'a' ? { ...node, parentId: 'b' } : node));
const POSITIONS: NodePositions = new Map<string, Point>([
  ['root', { x: 0, y: 0 }],
  ['a', { x: 100, y: -50 }],
  ['a1', { x: 200, y: -50 }],
  ['b', { x: 100, y: 50 }],
]);
const SCENE: DropScene = { tree: buildTree(DATA), positions: POSITIONS, placedPositions: POSITIONS };
const OFFSET: Point = { x: 30, y: 40 };
const RENAME_A: EditRequest = { type: 'rename', nodeId: 'a', text: 'Typed label' };
const MOVE_A_UNDER_B: EditRequest = { type: 'move', nodeId: 'a', newParentId: 'b' };

/** Handler whose promise the test settles by hand. */
class ManualHost {
  private settle: { resolve: (data: MindmapData) => void; reject: (error: unknown) => void } | null = null;

  readonly handle: EditHandler = () =>
    new Promise((resolve, reject) => {
      this.settle = { resolve, reject };
    });

  resolve(data: MindmapData): void {
    this.settle?.resolve(data);
  }

  reject(error: unknown): void {
    this.settle?.reject(error);
  }
}

function settledOf(result: EditSubmitResult): Promise<void> {
  if (result.kind !== 'sent') throw new Error(`Expected the request to be sent, was refused: [${result.reason}]`);
  return result.settled;
}

function hasDraftNode(data: MindmapData): boolean {
  return data.some((node) => node.id === DRAFT_NODE_ID);
}

describe('addDraftRequest', () => {
  it('WHEN adding to the root with a side THEN the draft keeps the side', () => {
    expect(addDraftRequest(DATA, 'root', 'left')).toEqual({ type: 'add', parentId: 'root', text: '', side: 'left' });
  });

  it('WHEN adding to a non-root node with a side THEN the side is dropped', () => {
    expect(addDraftRequest(DATA, 'a', 'left')).toEqual({ type: 'add', parentId: 'a', text: '' });
  });

  it('WHEN the parent is not in the data THEN there is no draft', () => {
    expect(addDraftRequest(DATA, 'gone', undefined)).toBeNull();
  });
});

describe('LocalEditState', () => {
  let host: ManualHost;
  let session: EditSession;
  let state: LocalEditState;
  /** What each status change asked to reopen for retry, in order. */
  let retries: (EditRequest | null)[];
  /** Every override set reported for the host, in order. */
  let reported: PositionOverrides[];

  beforeEach(() => {
    host = new ManualHost();
    retries = [];
    reported = [];
    // Wired like the mount: every status change reaches the state.
    session = new EditSession(DATA, host.handle, (status) => retries.push(state.onEditStatusChange(status)));
    state = new LocalEditState(session, (overrides) => reported.push(overrides));
  });

  describe('GIVEN no draft and no pending edit', () => {
    it('WHEN asked for display data THEN it is the confirmed data', () => {
      expect(state.displayData()).toBe(DATA);
    });

    it('WHEN asked whether an editor may open THEN nothing blocks it', () => {
      expect(state.editorBlockedReason()).toBeNull();
    });
  });

  describe('GIVEN a draft child of a', () => {
    beforeEach(() => state.showDraft({ type: 'add', parentId: 'a', text: '' }));

    it('WHEN asked for display data twice THEN it is the same object, so the scene cache holds', () => {
      expect(state.displayData()).toBe(state.displayData());
    });

    it('WHEN asked for display data THEN the draft shows as a child of a', () => {
      expect(state.displayData().find((node) => node.id === DRAFT_NODE_ID)?.parentId).toBe('a');
    });

    it('WHEN the host data no longer has a THEN the draft is not shown', () => {
      session.setHostData(DATA.filter((node) => node.id !== 'a' && node.id !== 'a1'));
      expect(hasDraftNode(state.displayData())).toBe(false);
    });

    it('WHEN the draft is cleared THEN it is not shown', () => {
      state.clearDraft();
      expect(hasDraftNode(state.displayData())).toBe(false);
    });

    it('WHEN an edit is pending THEN the draft is not shown', () => {
      session.submit(RENAME_A);
      expect(hasDraftNode(state.displayData())).toBe(false);
    });
  });

  describe('GIVEN a pending rename', () => {
    beforeEach(() => session.submit(RENAME_A));

    it('WHEN asked for display data THEN it is the pending preview', () => {
      expect(state.displayData().find((node) => node.id === 'a')?.text).toBe('Typed label');
    });

    it('WHEN asked whether an editor may open THEN it is blocked with the wait reason', () => {
      expect(state.editorBlockedReason()).toBe(EDIT_BLOCKED_REASON);
    });
  });

  describe('GIVEN a dragged by an offset and dropped away from any node', () => {
    let reposition: ReturnType<LocalEditState['dropAway']>;
    beforeEach(() => {
      reposition = state.dropAway(SCENE, 'a', OFFSET);
    });

    it('WHEN the drop is handled THEN it reports a at its start position plus the offset', () => {
      expect(reposition).toEqual({ nodeId: 'a', position: { x: 130, y: -10 } });
    });

    it('WHEN asked for overrides THEN a has its drop point as an offset from its parent', () => {
      expect(state.effectiveOverrides().get('a')).toEqual({ dx: 130, dy: -10 });
    });

    it('WHEN the drop is handled THEN the host is told the overrides with a in them', () => {
      expect(reported).toEqual([state.effectiveOverrides()]);
    });
  });

  describe('GIVEN a scene where the parent a is drawn pushed 10 right of where it is placed', () => {
    const pushedScene: DropScene = { ...SCENE, positions: new Map([...POSITIONS, ['a', { x: 110, y: -50 }]]) };

    it('WHEN its child is dropped away THEN the offset is measured from where a is placed, not drawn', () => {
      state.dropAway(pushedScene, 'a1', OFFSET);
      expect(state.effectiveOverrides().get('a1')).toEqual({ dx: 130, dy: 40 });
    });
  });

  describe('GIVEN the root', () => {
    it('WHEN it is dropped away THEN nothing is reported, as the root never moves', () => {
      expect(state.dropAway(SCENE, 'root', OFFSET)).toBeNull();
    });
  });

  describe('GIVEN overrides set by the host', () => {
    beforeEach(() => state.setOverrides(new Map([['b', { dx: 5, dy: 6 }]])));

    it('WHEN asked for overrides THEN they are the host ones', () => {
      expect(state.effectiveOverrides().get('b')).toEqual({ dx: 5, dy: 6 });
    });

    it('WHEN set THEN they are not reported back to the host', () => {
      expect(reported).toEqual([]);
    });
  });

  describe('GIVEN a node that is not in the scene', () => {
    it('WHEN it is dropped away THEN nothing is reported', () => {
      expect(state.dropAway(SCENE, 'gone', OFFSET)).toBeNull();
    });

    it('WHEN it is dropped away THEN no override is stored', () => {
      state.dropAway(SCENE, 'gone', OFFSET);
      expect(state.effectiveOverrides().size).toBe(0);
    });

    it('WHEN it is dropped away THEN nothing is reported to the host', () => {
      state.dropAway(SCENE, 'gone', OFFSET);
      expect(reported).toEqual([]);
    });
  });

  describe('GIVEN overrides on a, its child a1 and b', () => {
    beforeEach(() => {
      state.dropAway(SCENE, 'a1', OFFSET);
      state.dropAway(SCENE, 'a', OFFSET);
      state.dropAway(SCENE, 'b', OFFSET);
    });

    describe('AND a pending move of a under b', () => {
      let result: EditSubmitResult;
      beforeEach(() => {
        result = session.submit(MOVE_A_UNDER_B);
      });

      it('WHEN asked for overrides twice while pending THEN it is the same map, so the scene cache holds', () => {
        expect(state.effectiveOverrides()).toBe(state.effectiveOverrides());
      });

      it('WHEN asked for overrides while pending THEN only b keeps one, so a previews at its new layout spot', () => {
        expect([...state.effectiveOverrides().keys()]).toEqual(['b']);
      });

      it('WHEN the host confirms THEN the moved subtree loses its overrides and b keeps its own', async () => {
        host.resolve(A_MOVED_UNDER_B);
        await settledOf(result);
        expect([...state.effectiveOverrides().keys()]).toEqual(['b']);
      });

      it('WHEN the host confirms THEN the host is told only b keeps an override', async () => {
        host.resolve(A_MOVED_UNDER_B);
        await settledOf(result);
        expect([...reported.at(-1)!.keys()]).toEqual(['b']);
      });

      it('WHEN the host rejects THEN all overrides are kept', async () => {
        host.reject(new Error('No'));
        await settledOf(result);
        expect([...state.effectiveOverrides().keys()].sort()).toEqual(['a', 'a1', 'b']);
      });

      it('WHEN the host rejects THEN nothing new is reported', async () => {
        const reportedBefore = reported.length;
        host.reject(new Error('No'));
        await settledOf(result);
        expect(reported.length).toBe(reportedBefore);
      });
    });

    it('WHEN a rename of a is confirmed THEN all overrides are kept', async () => {
      const result = session.submit(RENAME_A);
      host.resolve(DATA.map((node) => (node.id === 'a' ? { ...node, text: RENAME_A.text } : node)));
      await settledOf(result);
      expect([...state.effectiveOverrides().keys()].sort()).toEqual(['a', 'a1', 'b']);
    });
  });

  describe('GIVEN a rename sent from the inline editor', () => {
    let result: EditSubmitResult;
    beforeEach(() => {
      state.sentFromEditor(RENAME_A);
      result = session.submit(RENAME_A);
    });

    it('WHEN the host rejects it THEN it is reopened for retry', async () => {
      host.reject(new Error('No'));
      await settledOf(result);
      expect(retries.at(-1)).toBe(RENAME_A);
    });

    it('WHEN the host confirms it THEN nothing is reopened', async () => {
      host.resolve(DATA);
      await settledOf(result);
      expect(retries.at(-1)).toBeNull();
    });

    it('WHEN it was confirmed and the same request is later rejected without the editor THEN nothing is reopened', async () => {
      host.resolve(DATA);
      await settledOf(result);
      const again = session.submit(RENAME_A);
      host.reject(new Error('No'));
      await settledOf(again);
      expect(retries.at(-1)).toBeNull();
    });
  });

  describe('GIVEN a first-level add with a side sent from the inline editor', () => {
    const addLeft: EditRequest = { type: 'add', parentId: 'root', text: 'New', side: 'left' };

    it('WHEN the host rejects it THEN the reopened request keeps the side', async () => {
      state.sentFromEditor(addLeft);
      const result = session.submit(addLeft);
      host.reject(new Error('No'));
      await settledOf(result);
      expect(retries.at(-1)).toEqual(addLeft);
    });
  });

  describe('GIVEN a delete not sent from the inline editor', () => {
    it('WHEN the host rejects it THEN nothing is reopened', async () => {
      state.sentFromEditor(RENAME_A);
      const result = session.submit({ type: 'delete', nodeId: 'b' });
      host.reject(new Error('No'));
      await settledOf(result);
      expect(retries.at(-1)).toBeNull();
    });
  });
});

/** Builds the scene a host would see with `overrides`, like the mount does. */
function sceneOf(data: MindmapData, overrides: PositionOverrides): Scene {
  return buildScene(data, DEFAULT_CONFIG, DEFAULT_EXTENSIONS, overrides);
}

function plus(point: Point, offset: NodeOffset): Point {
  return { x: point.x + offset.dx, y: point.y + offset.dy };
}

describe('GIVEN Macbeth dragged into empty space and the reported positions saved as JSON', () => {
  const DRAG: Point = { x: -120, y: -260 };
  const MACBETH: NodeId = 'macbeth';
  let dropPoint: Point;
  let saved: string;

  beforeAll(() => {
    let last: PositionOverrides = new Map();
    const state = new LocalEditState(new EditSession(REFERENCE_DATA, DEFAULT_EDIT_HANDLER, () => {}), (overrides) => {
      last = overrides;
    });
    dropPoint = state.dropAway(sceneOf(REFERENCE_DATA, new Map()), MACBETH, DRAG)!.position;
    saved = JSON.stringify(nodeOffsetsOf(last));
  });

  function restored(data: MindmapData): Scene {
    return sceneOf(data, overridesFromNodeOffsets(JSON.parse(saved) as NodeOffsets));
  }

  it('WHEN restored onto the same map THEN Macbeth is drawn where it was dropped', () => {
    expect(restored(REFERENCE_DATA).positions.get(MACBETH)).toEqual(dropPoint);
  });

  it('WHEN restored after a node was added that moves its parent THEN Macbeth keeps its offset from the parent', () => {
    const withNewNode: MindmapData = [...REFERENCE_DATA, { id: 'new', parentId: 'root', text: 'NEW', side: 'left' }];
    const offset = (JSON.parse(saved) as NodeOffsets)[MACBETH]!;
    const scene = restored(withNewNode);
    expect(
      sceneOf(withNewNode, new Map()).positions.get('tragedia'),
      'precondition: the new node moves Tragedia',
    ).not.toEqual(sceneOf(REFERENCE_DATA, new Map()).positions.get('tragedia'));
    expect(scene.positions.get(MACBETH)).toEqual(plus(scene.placedPositions.get('tragedia')!, offset));
  });
});
