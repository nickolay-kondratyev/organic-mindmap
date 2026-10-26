import { DEFAULT_CONFIG, type MindmapConfig } from '../config/config';
import type { MoveEditRequest } from '../edit/editRequest';
import type { MindmapData } from '../model/node';
import { ReparentConfirmation, type ReparentConfirmationHost } from './reparentConfirmation';

const DATA: MindmapData = [
  { id: 'root', parentId: null, text: 'R' },
  { id: 'a', parentId: 'root', text: 'Hamlet' },
  { id: 'b', parentId: 'root', text: 'POESIA' },
];
const MOVE_A_UNDER_B: MoveEditRequest = { type: 'move', nodeId: 'a', newParentId: 'b' };
const CONFIRMATION_OFF: MindmapConfig = { ...DEFAULT_CONFIG, interaction: { ...DEFAULT_CONFIG.interaction, confirmReparent: false } };

/** Records what the confirmation sends and which settings it changes. */
class RecordingHost implements ReparentConfirmationHost {
  readonly sent: MoveEditRequest[] = [];
  readonly configChanges: MindmapConfig[] = [];

  constructor(private current: MindmapConfig) {}

  config(): MindmapConfig {
    return this.current;
  }

  changeConfig(config: MindmapConfig): void {
    this.current = config;
    this.configChanges.push(config);
  }

  send(request: MoveEditRequest): void {
    this.sent.push(request);
  }
}

describe('GIVEN reparent confirmation is on (the default)', () => {
  let host: RecordingHost;
  let confirmation: ReparentConfirmation;
  beforeEach(() => {
    host = new RecordingHost(DEFAULT_CONFIG);
    confirmation = new ReparentConfirmation(host);
  });

  it('WHEN a node is dropped onto another THEN nothing is sent yet', () => {
    confirmation.drop(MOVE_A_UNDER_B, DATA);
    expect(host.sent).toEqual([]);
  });

  it('WHEN a node is dropped onto another THEN the move waits for an answer', () => {
    confirmation.drop(MOVE_A_UNDER_B, DATA);
    expect(confirmation.pending?.request).toBe(MOVE_A_UNDER_B);
  });

  it('WHEN a node is dropped onto another THEN the question names both nodes by their labels', () => {
    expect(confirmation.drop(MOVE_A_UNDER_B, DATA)?.text).toBe('Make "Hamlet" a child of "POESIA"?');
  });

  it('WHEN the drop is confirmed THEN the move is sent', () => {
    confirmation.drop(MOVE_A_UNDER_B, DATA);
    confirmation.confirm({ dontAskAgain: false });
    expect(host.sent).toEqual([MOVE_A_UNDER_B]);
  });

  it('WHEN the drop is confirmed THEN nothing waits any more', () => {
    confirmation.drop(MOVE_A_UNDER_B, DATA);
    confirmation.confirm({ dontAskAgain: false });
    expect(confirmation.pending).toBeNull();
  });

  it('WHEN the drop is confirmed without "Don\'t ask again" THEN the settings stay as they were', () => {
    confirmation.drop(MOVE_A_UNDER_B, DATA);
    confirmation.confirm({ dontAskAgain: false });
    expect(host.configChanges).toEqual([]);
  });

  it('WHEN the drop is confirmed with "Don\'t ask again" THEN confirmation is turned off in the settings', () => {
    confirmation.drop(MOVE_A_UNDER_B, DATA);
    confirmation.confirm({ dontAskAgain: true });
    expect(host.configChanges).toEqual([CONFIRMATION_OFF]);
  });

  it('WHEN the drop is cancelled THEN nothing is sent', () => {
    confirmation.drop(MOVE_A_UNDER_B, DATA);
    confirmation.cancel();
    expect(host.sent).toEqual([]);
  });

  it('WHEN the drop is cancelled THEN nothing waits any more', () => {
    confirmation.drop(MOVE_A_UNDER_B, DATA);
    confirmation.cancel();
    expect(confirmation.pending).toBeNull();
  });

  it('WHEN confirming with nothing waiting THEN nothing is sent', () => {
    confirmation.confirm({ dontAskAgain: true });
    expect(host.sent).toEqual([]);
  });
});

describe('GIVEN reparent confirmation is off', () => {
  let host: RecordingHost;
  let confirmation: ReparentConfirmation;
  beforeEach(() => {
    host = new RecordingHost(CONFIRMATION_OFF);
    confirmation = new ReparentConfirmation(host);
  });

  it('WHEN a node is dropped onto another THEN the move is sent right away', () => {
    confirmation.drop(MOVE_A_UNDER_B, DATA);
    expect(host.sent).toEqual([MOVE_A_UNDER_B]);
  });

  it('WHEN a node is dropped onto another THEN no question is asked', () => {
    expect(confirmation.drop(MOVE_A_UNDER_B, DATA)).toBeNull();
  });
});
