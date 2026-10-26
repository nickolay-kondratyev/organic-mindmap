import { REFERENCE_DATA, type EditRequest, type MindmapData } from 'natural-mindmap';
import { DEMO_REJECTION_REASON, ResettableEditHandler, describeDelay, toHostSimulation } from './demoHost';

describe('GIVEN the host simulation settings', () => {
  it('WHEN rejecting is on THEN the in-memory host rejects with the demo reason', () => {
    expect(toHostSimulation({ delayMs: 0, rejectEdits: true }).rejectReason).toBe(DEMO_REJECTION_REASON);
  });

  it('WHEN rejecting is off THEN the in-memory host does not reject', () => {
    expect(toHostSimulation({ delayMs: 0, rejectEdits: false }).rejectReason).toBeNull();
  });

  it('WHEN a delay is set THEN the in-memory host waits that long', () => {
    expect(toHostSimulation({ delayMs: 1500, rejectEdits: false }).delayMs).toBe(1500);
  });
});

describe('GIVEN an answer delay', () => {
  it('WHEN it is zero THEN it reads as instant', () => {
    expect(describeDelay(0)).toBe('Instant');
  });

  it('WHEN it is positive THEN it reads in seconds', () => {
    expect(describeDelay(1500)).toBe('1.5 s');
  });
});

const RENAME: EditRequest = { type: 'rename', nodeId: 'hamlet', text: 'Ophelia' };
const HOST_ANSWER: MindmapData = REFERENCE_DATA.map((node) => (node.id === 'hamlet' ? { ...node, text: 'Ophelia' } : node));

describe('GIVEN an edit request the host has not answered yet', () => {
  let answer: (data: MindmapData) => void;
  let confirmed: MindmapData[];
  let edits: ResettableEditHandler;

  beforeEach(() => {
    confirmed = [];
    edits = new ResettableEditHandler(
      () => new Promise<MindmapData>((resolve) => (answer = resolve)),
      (data) => confirmed.push(data),
    );
  });

  it('WHEN the host answers THEN the confirmed data is reported', async () => {
    const sent = edits.handle(RENAME, REFERENCE_DATA);
    answer(HOST_ANSWER);
    await sent;
    expect(confirmed).toEqual([HOST_ANSWER]);
  });

  it('WHEN the map is reset before the host answers THEN the late answer is not reported', async () => {
    const sent = edits.handle(RENAME, REFERENCE_DATA);
    edits.discardPending();
    answer(HOST_ANSWER);
    await sent;
    expect(confirmed).toEqual([]);
  });

  it('WHEN a request is sent after a reset THEN its answer is reported', async () => {
    edits.discardPending();
    const sent = edits.handle(RENAME, REFERENCE_DATA);
    answer(HOST_ANSWER);
    await sent;
    expect(confirmed).toEqual([HOST_ANSWER]);
  });
});
