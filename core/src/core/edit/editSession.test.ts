import type { MindmapData } from '../model/node';
import type { EditHandler, EditRequest } from './editRequest';
import { EDIT_PROBLEM } from './editValidation';
import {
  DEFAULT_REJECTION_REASON,
  EDIT_BLOCKED_REASON,
  EditSession,
  PENDING_NODE_ID,
  type EditStatus,
  type EditSubmitResult,
} from './editSession';

const DATA: MindmapData = [
  { id: 'root', parentId: null, text: 'R' },
  { id: 'a', parentId: 'root', text: 'A' },
  { id: 'a1', parentId: 'a', text: 'A1' },
  { id: 'b', parentId: 'root', text: 'B' },
];
const HOST_DATA: MindmapData = [
  { id: 'root', parentId: null, text: 'R' },
  { id: 'a', parentId: 'root', text: 'Host renamed' },
];
const RENAME: EditRequest = { type: 'rename', nodeId: 'a', text: 'Typed label' };

/** Handler whose promise the test settles by hand, recording what was sent. */
class ManualHost {
  readonly requests: EditRequest[] = [];
  private settle: { resolve: (data: MindmapData) => void; reject: (error: unknown) => void } | null = null;

  readonly handle: EditHandler = (request) => {
    this.requests.push(request);
    return new Promise((resolve, reject) => {
      this.settle = { resolve, reject };
    });
  };

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

describe('EditSession', () => {
  let host: ManualHost;
  let statuses: EditStatus[];
  let session: EditSession;

  beforeEach(() => {
    host = new ManualHost();
    statuses = [];
    session = new EditSession(DATA, host.handle, (status) => statuses.push(status));
  });

  describe('GIVEN a rename was submitted and the host has not answered', () => {
    beforeEach(() => {
      session.submit(RENAME);
    });

    it('WHEN reading the status THEN it is pending with the request', () => {
      expect(session.status).toEqual({ kind: 'pending', request: RENAME });
    });

    it('WHEN reading the display data THEN it shows the intended result', () => {
      expect(session.displayData.find((n) => n.id === 'a')?.text).toBe('Typed label');
    });

    it('WHEN reading the preview THEN it marks the renamed node as pending', () => {
      expect(session.preview?.nodeId).toBe('a');
    });

    it('WHEN reading the display data twice (two busy-animation frames) THEN it is the same object, so the scene cache holds', () => {
      expect(session.displayData).toBe(session.displayData);
    });

    it('WHEN reading the confirmed data THEN it is still the host data', () => {
      expect(session.confirmedData).toBe(DATA);
    });

    it('WHEN submitting another edit THEN it is refused as blocked', () => {
      expect(session.submit({ type: 'delete', nodeId: 'b' })).toEqual({ kind: 'refused', reason: EDIT_BLOCKED_REASON });
    });

    it('WHEN submitting another edit THEN nothing more is sent to the host', () => {
      session.submit({ type: 'delete', nodeId: 'b' });
      expect(host.requests).toHaveLength(1);
    });

    it('WHEN the host pushes new data THEN the preview is derived from it', () => {
      session.setHostData(HOST_DATA);
      expect(session.displayData.map((n) => n.text)).toEqual(['R', 'Typed label']);
    });

    it('WHEN the host pushes data without the node THEN the preview is dropped', () => {
      session.setHostData([{ id: 'root', parentId: null, text: 'R' }]);
      expect(session.preview).toBeNull();
    });
  });

  describe('GIVEN a pending rename', () => {
    let result: EditSubmitResult;

    beforeEach(() => {
      result = session.submit(RENAME);
    });

    it('WHEN the host confirms THEN the display data is exactly the host data', async () => {
      host.resolve(HOST_DATA);
      await settledOf(result);
      expect(session.displayData).toBe(HOST_DATA);
    });

    it('WHEN the host confirms THEN the status returns to idle', async () => {
      host.resolve(HOST_DATA);
      await settledOf(result);
      expect(session.status).toEqual({ kind: 'idle' });
    });

    it('WHEN the host confirms THEN listeners saw pending then idle', async () => {
      host.resolve(HOST_DATA);
      await settledOf(result);
      expect(statuses.map((s) => s.kind)).toEqual(['pending', 'idle']);
    });

    it('WHEN the host rejects THEN the prior data is shown again', async () => {
      host.reject(new Error('File is locked.'));
      await settledOf(result);
      expect(session.displayData).toBe(DATA);
    });

    it('WHEN the host rejects THEN its reason and the typed request are kept for retry', async () => {
      host.reject(new Error('File is locked.'));
      await settledOf(result);
      expect(session.status).toEqual({ kind: 'rejected', request: RENAME, reason: 'File is locked.' });
    });

    it('WHEN the host rejects with a plain string THEN that string is the reason', async () => {
      host.reject('No permission.');
      await settledOf(result);
      expect(session.status).toMatchObject({ reason: 'No permission.' });
    });

    it('WHEN the host rejects without a message THEN a plain default reason is shown', async () => {
      host.reject(undefined);
      await settledOf(result);
      expect(session.status).toMatchObject({ reason: DEFAULT_REJECTION_REASON });
    });

    it('WHEN the session is disposed before the host answers THEN the late answer is ignored', async () => {
      session.dispose();
      host.resolve(HOST_DATA);
      await settledOf(result);
      expect(session.confirmedData).toBe(DATA);
    });
  });

  describe('GIVEN a rejected edit', () => {
    beforeEach(async () => {
      const result = session.submit(RENAME);
      host.reject(new Error('File is locked.'));
      await settledOf(result);
    });

    it('WHEN submitting again THEN the request is sent', () => {
      expect(session.submit(RENAME).kind).toBe('sent');
    });

    it('WHEN clearing the rejection THEN the status is idle', () => {
      session.clearRejection();
      expect(session.status).toEqual({ kind: 'idle' });
    });
  });

  describe('GIVEN an idle session', () => {
    it('WHEN dropping a node onto its own descendant THEN it is refused with the reason', () => {
      expect(session.submit({ type: 'move', nodeId: 'a', newParentId: 'a1' })).toEqual({
        kind: 'refused',
        reason: EDIT_PROBLEM.moveIntoOwnBranch,
      });
    });

    it('WHEN dropping a node onto itself THEN no request is sent', () => {
      session.submit({ type: 'move', nodeId: 'a', newParentId: 'a' });
      expect(host.requests).toEqual([]);
    });

    it('WHEN an add is pending THEN the preview shows a provisional child under the parent', () => {
      session.submit({ type: 'add', parentId: 'b', text: 'New' });
      expect(session.displayData.find((n) => n.id === PENDING_NODE_ID)?.parentId).toBe('b');
    });

    it('WHEN a delete is pending THEN the node stays visible and is marked pending', () => {
      session.submit({ type: 'delete', nodeId: 'a' });
      expect(session.preview).toEqual({ data: DATA, nodeId: 'a' });
    });

    it('WHEN a move is pending THEN the preview shows the node under its new parent', () => {
      session.submit({ type: 'move', nodeId: 'a', newParentId: 'b' });
      expect(session.displayData.find((n) => n.id === 'a')?.parentId).toBe('b');
    });

    it('WHEN the handler throws synchronously THEN the edit is rejected with its message', async () => {
      const throwing = new EditSession(
        DATA,
        () => {
          throw new Error('Host crashed.');
        },
        () => {},
      );
      await settledOf(throwing.submit(RENAME));
      expect(throwing.status).toMatchObject({ kind: 'rejected', reason: 'Host crashed.' });
    });
  });
});
