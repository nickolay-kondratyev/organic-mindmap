import type { MindmapData } from '../model/node';
import type { EditRequest } from './editRequest';
import { EDIT_PROBLEM } from './editValidation';
import { InMemoryHost } from './inMemoryHost';

const DATA: MindmapData = [
  { id: 'root', parentId: null, text: 'R' },
  { id: 'node-1', parentId: 'root', text: 'Taken id' },
];
const RENAME: EditRequest = { type: 'rename', nodeId: 'node-1', text: 'Renamed' };
const DELAY_MS = 500;

describe('InMemoryHost', () => {
  describe('GIVEN the default simulation', () => {
    const host = new InMemoryHost();

    it('WHEN handling a rename THEN it confirms with the applied data', async () => {
      const result = await host.handle(RENAME, DATA);
      expect(result.find((n) => n.id === 'node-1')?.text).toBe('Renamed');
    });

    it('WHEN handling an add THEN the new node gets an id not already taken', async () => {
      const result = await host.handle({ type: 'add', parentId: 'root', text: 'New' }, DATA);
      expect(result.at(-1)?.id).toBe('node-2');
    });

    it('WHEN handling an invalid request THEN it rejects with the plain reason', async () => {
      await expect(host.handle({ type: 'delete', nodeId: 'root' }, DATA)).rejects.toThrow(EDIT_PROBLEM.deleteRoot);
    });
  });

  describe('GIVEN a simulated delay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('WHEN less than the delay has passed THEN the request is still unanswered', async () => {
      const host = new InMemoryHost({ delayMs: DELAY_MS, rejectReason: null });
      let answered = false;
      void host.handle(RENAME, DATA).then(() => {
        answered = true;
      });
      await vi.advanceTimersByTimeAsync(DELAY_MS - 1);
      expect(answered).toBe(false);
    });

    it('WHEN the delay has passed THEN the request is confirmed', async () => {
      const host = new InMemoryHost({ delayMs: DELAY_MS, rejectReason: null });
      const answer = host.handle(RENAME, DATA);
      await vi.advanceTimersByTimeAsync(DELAY_MS);
      await expect(answer).resolves.toHaveLength(DATA.length);
    });
  });

  describe('GIVEN simulated rejection', () => {
    it('WHEN handling a valid request THEN it rejects with the configured reason', async () => {
      const host = new InMemoryHost({ delayMs: 0, rejectReason: 'Simulated failure.' });
      await expect(host.handle(RENAME, DATA)).rejects.toThrow('Simulated failure.');
    });

    it('WHEN the simulation is switched back to confirm THEN later requests are confirmed', async () => {
      const host = new InMemoryHost({ delayMs: 0, rejectReason: 'Simulated failure.' });
      host.setSimulation({ delayMs: 0, rejectReason: null });
      await expect(host.handle(RENAME, DATA)).resolves.toHaveLength(DATA.length);
    });
  });
});
