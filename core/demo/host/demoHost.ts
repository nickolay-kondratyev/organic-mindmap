import { useCallback, useState } from 'react';
import { InMemoryHost, REFERENCE_DATA, type EditHandler, type EditStatus, type HostSimulation, type MindmapData } from 'natural-mindmap';

export const DEMO_REJECTION_REASON = 'The demo host is set to reject every change.';

/** What the runner's "Host simulation" controls set (spec D5), in the user's terms. */
export interface HostSimulationSettings {
  readonly delayMs: number;
  readonly rejectEdits: boolean;
}

export const DEFAULT_HOST_SIMULATION_SETTINGS: HostSimulationSettings = { delayMs: 0, rejectEdits: false };

const IDLE: EditStatus = { kind: 'idle' };

export function toHostSimulation(settings: HostSimulationSettings): HostSimulation {
  return { delayMs: settings.delayMs, rejectReason: settings.rejectEdits ? DEMO_REJECTION_REASON : null };
}

const MS_PER_SECOND = 1000;

/** Slider readout: "Instant" or seconds, e.g. "1.5 s". */
export function describeDelay(delayMs: number): string {
  return delayMs === 0 ? 'Instant' : `${delayMs / MS_PER_SECOND} s`;
}

export interface DemoHost {
  /** Host-owned data (spec L2); the map renders exactly this. */
  readonly data: MindmapData;
  /** Changes whenever the map is replaced, so it remounts: clears dragged positions, the view and any shown rejection. */
  readonly mapKey: number;
  readonly editStatus: EditStatus;
  readonly simulation: HostSimulationSettings;
  setSimulation(settings: HostSimulationSettings): void;
  readonly onEditRequest: EditHandler;
  onEditStatusChange(status: EditStatus): void;
  /** "Reset map" (D6): back to the reference data. */
  resetMap(): void;
  /** Shows other data as a fresh map, e.g. the headings of pasted Markdown (D7). */
  replaceMap(data: MindmapData): void;
}

/**
 * Forwards edit requests to `handler` and reports the confirmed data, except answers to requests sent before the
 * latest `discardPending()` (the map was replaced, D6/D7): those must not overwrite the new data.
 */
export class ResettableEditHandler {
  private generation = 0;

  constructor(
    private readonly handler: EditHandler,
    private readonly onConfirmed: (data: MindmapData) => void,
  ) {}

  /** Bound so it can be passed straight as `onEditRequest`. */
  readonly handle: EditHandler = async (request, currentData) => {
    const generation = this.generation;
    const next = await this.handler(request, currentData);
    if (generation === this.generation) this.onConfirmed(next);
    return next;
  };

  discardPending(): void {
    this.generation += 1;
  }
}

/**
 * The runner as a real host would be (spec D1/D4): it owns the data in React state and answers edit requests
 * with the library's in-memory host (I6), whose delay/reject simulation the panel controls (D5).
 */
export function useDemoHost(): DemoHost {
  const [host] = useState(() => new InMemoryHost());
  const [data, setData] = useState<MindmapData>(REFERENCE_DATA);
  const [mapKey, setMapKey] = useState(0);
  const [editStatus, setEditStatus] = useState<EditStatus>(IDLE);
  const [simulation, setSimulationState] = useState(DEFAULT_HOST_SIMULATION_SETTINGS);
  const [edits] = useState(() => new ResettableEditHandler(host.handle, setData));

  const setSimulation = useCallback(
    (settings: HostSimulationSettings) => {
      host.setSimulation(toHostSimulation(settings));
      setSimulationState(settings);
    },
    [host],
  );

  const replaceMap = useCallback(
    (next: MindmapData) => {
      edits.discardPending();
      setData(next);
      setEditStatus(IDLE);
      setMapKey((key) => key + 1);
    },
    [edits],
  );
  const resetMap = useCallback(() => replaceMap(REFERENCE_DATA), [replaceMap]);

  return {
    data,
    mapKey,
    editStatus,
    simulation,
    setSimulation,
    onEditRequest: edits.handle,
    onEditStatusChange: setEditStatus,
    resetMap,
    replaceMap,
  };
}
