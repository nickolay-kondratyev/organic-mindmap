import type { MindmapData, NodeId } from '../model/node';
import { applyEdit } from './applyEdit';
import type { EditHandler } from './editRequest';
import { findEditProblem } from './editValidation';

/** How the in-memory host answers, so pending and rejected states can be seen without a real host (spec D5). */
export interface HostSimulation {
  /** Wait this long before answering; `0` answers right away. */
  readonly delayMs: number;
  /** When set, every request is rejected with this reason. */
  readonly rejectReason: string | null;
}

export const CONFIRM_IMMEDIATELY: HostSimulation = { delayMs: 0, rejectReason: null };

const GENERATED_ID_PREFIX = 'node-';

/**
 * Default host (spec I6): applies requests to the data it is handed and confirms. Stateless with respect to
 * data, so it always agrees with whatever the library last showed as confirmed.
 */
export class InMemoryHost {
  private simulation: HostSimulation;

  constructor(simulation: HostSimulation = CONFIRM_IMMEDIATELY) {
    this.simulation = simulation;
  }

  setSimulation(simulation: HostSimulation): void {
    this.simulation = simulation;
  }

  /** Bound so it can be passed straight as `onEditRequest`. */
  readonly handle: EditHandler = async (request, currentData) => {
    // Snapshot: a toggle flipped while this request waits applies to the next request, not this one.
    const { delayMs, rejectReason } = this.simulation;
    if (delayMs > 0) await delay(delayMs);
    if (rejectReason !== null) throw new Error(rejectReason);
    const problem = findEditProblem(currentData, request);
    if (problem !== null) throw new Error(problem);
    return applyEdit(currentData, request, nextFreeNodeId(currentData));
  };
}

/** Handler used when the host supplies none: the library then works standalone (spec I6). */
export const DEFAULT_EDIT_HANDLER: EditHandler = new InMemoryHost().handle;

/** Smallest `node-N` (N >= 1) not already taken; deterministic for the same data (spec Q1). */
function nextFreeNodeId(data: MindmapData): NodeId {
  const taken = new Set(data.map((node) => node.id));
  for (let n = 1; ; n += 1) {
    const id = `${GENERATED_ID_PREFIX}${n}`;
    if (!taken.has(id)) return id;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
