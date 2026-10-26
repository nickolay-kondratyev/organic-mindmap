import type { MindmapConfig } from '../config/config';
import type { MoveEditRequest } from '../edit/editRequest';
import type { MindmapData, NodeId } from '../model/node';

/** What `ReparentConfirmation` needs from the mount: the live settings and the edit protocol. */
export interface ReparentConfirmationHost {
  config(): MindmapConfig;
  /** The user changed a setting from inside the map; the host stores it (see `MountOptions.onConfigChange`). */
  changeConfig(config: MindmapConfig): void;
  send(request: MoveEditRequest): void;
}

/** A drop onto a node waiting for the user's yes or no. */
export interface ReparentQuestion {
  readonly request: MoveEditRequest;
  /** Plain-language question naming both nodes by label, e.g. `Make "Hamlet" a child of "POESIA"?`. */
  readonly text: string;
}

export interface ReparentAnswer {
  /** "Don't ask again": turns `interaction.confirmReparent` off, so later drops reparent right away. */
  readonly dontAskAgain: boolean;
}

/**
 * Asks before a drop onto a node becomes a reparent (spec I3), unless `interaction.confirmReparent` is off.
 * DOM-free: `CanvasInteractions` shows the question and passes the answer back. Nothing is sent while the
 * question is open, so cancelling leaves the map exactly as before the drag.
 */
export class ReparentConfirmation {
  private question: ReparentQuestion | null = null;

  constructor(private readonly host: ReparentConfirmationHost) {}

  /** The question being asked, or `null` when nothing waits. */
  get pending(): ReparentQuestion | null {
    return this.question;
  }

  /** Sends `request` right away when confirmation is off and returns `null`; else holds it and returns the question to show. */
  drop(request: MoveEditRequest, data: MindmapData): ReparentQuestion | null {
    if (!this.host.config().interaction.confirmReparent) {
      this.host.send(request);
      return null;
    }
    this.question = { request, text: `Make "${labelOf(data, request.nodeId)}" a child of "${labelOf(data, request.newParentId)}"?` };
    return this.question;
  }

  confirm(answer: ReparentAnswer): void {
    const question = this.question;
    if (question === null) return;
    this.question = null;
    if (answer.dontAskAgain) this.host.changeConfig(withReparentConfirmation(this.host.config(), false));
    this.host.send(question.request);
  }

  cancel(): void {
    this.question = null;
  }
}

function withReparentConfirmation(config: MindmapConfig, confirmReparent: boolean): MindmapConfig {
  return { ...config, interaction: { ...config.interaction, confirmReparent } };
}

/** Falls back to the id: an unknown node is refused on send anyway (see `findEditProblem`). */
function labelOf(data: MindmapData, nodeId: NodeId): string {
  return data.find((node) => node.id === nodeId)?.text ?? nodeId;
}
