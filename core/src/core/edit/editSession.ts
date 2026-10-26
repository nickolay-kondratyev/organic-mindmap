import type { MindmapData, NodeId } from '../model/node';
import { applyEdit } from './applyEdit';
import type { EditHandler, EditRequest } from './editRequest';
import { findEditProblem } from './editValidation';
import { rememberLast } from '../memo/rememberLast';

/**
 * Where the request -> confirm protocol stands (spec I5). `rejected` keeps the request so typed input
 * (e.g. the new label) can be offered again for retry (I5.4).
 */
export type EditStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending'; readonly request: EditRequest }
  | { readonly kind: 'rejected'; readonly request: EditRequest; readonly reason: string };

export type EditSubmitResult =
  /** `settled` resolves (never rejects) once the host confirmed or rejected; read `status` for which. */
  | { readonly kind: 'sent'; readonly settled: Promise<void> }
  /** Nothing was sent: invalid request (I3) or another edit is still pending (I5.2). */
  | { readonly kind: 'refused'; readonly reason: string };

/** The intended result shown while a request is pending (I5.2); `nodeId` is the node to show as pending. */
export interface EditPreview {
  readonly data: MindmapData;
  readonly nodeId: NodeId;
}

/** Id of the not-yet-confirmed node in an `add` preview; the host picks the real id. */
export const PENDING_NODE_ID: NodeId = 'natural-mindmap:pending-node';
export const EDIT_BLOCKED_REASON = 'Please wait: the previous change is still being saved.';
/** Used when the host rejects without a usable message (e.g. `reject()` or a non-Error value). */
export const DEFAULT_REJECTION_REASON = 'The change could not be saved.';

const IDLE: EditStatus = { kind: 'idle' };

/**
 * Edit state machine over the host-confirmed data. It never applies a structural change to that data
 * itself (L2, I5.3): confirmed data only ever comes from the host (`setHostData` or the handler's result).
 */
export class EditSession {
  private hostData: MindmapData;
  private currentStatus: EditStatus = IDLE;
  private disposed = false;

  /** `onChange` fires when the status changes (and with it, possibly the confirmed data). */
  constructor(
    data: MindmapData,
    private readonly handler: EditHandler,
    private readonly onChange: (status: EditStatus) => void,
  ) {
    this.hostData = data;
  }

  get status(): EditStatus {
    return this.currentStatus;
  }

  /** Last host-confirmed data. */
  get confirmedData(): MindmapData {
    return this.hostData;
  }

  /**
   * Derived from the current confirmed data so host updates during a pending edit still show. `null` when
   * idle, or when the host's data no longer fits the request (e.g. the node vanished meanwhile).
   * Remembered per (data, status) so repaints of one pending edit see the same preview object (scene cache).
   */
  get preview(): EditPreview | null {
    return this.previewOf(this.hostData, this.currentStatus);
  }

  private readonly previewOf = rememberLast((data: MindmapData, status: EditStatus): EditPreview | null => {
    if (status.kind !== 'pending') return null;
    const request = status.request;
    if (findEditProblem(data, request) !== null) return null;
    switch (request.type) {
      case 'add':
        return { data: applyEdit(data, request, PENDING_NODE_ID), nodeId: PENDING_NODE_ID };
      case 'delete':
        // Keep the doomed subtree visible (shown as pending) instead of removing it before the host confirms.
        return { data, nodeId: request.nodeId };
      case 'move':
      case 'rename':
        return { data: applyEdit(data, request, PENDING_NODE_ID), nodeId: request.nodeId };
    }
  });

  /** What to render: the pending preview if any, else the confirmed data. */
  get displayData(): MindmapData {
    return this.preview?.data ?? this.hostData;
  }

  /** Host-pushed data (e.g. a new `data` prop). No `onChange`: the host already knows. */
  setHostData(data: MindmapData): void {
    this.hostData = data;
  }

  submit(request: EditRequest): EditSubmitResult {
    if (this.currentStatus.kind === 'pending') return { kind: 'refused', reason: EDIT_BLOCKED_REASON };
    const problem = findEditProblem(this.hostData, request);
    if (problem !== null) return { kind: 'refused', reason: problem };

    this.setStatus({ kind: 'pending', request });
    // `new Promise` turns a handler that throws synchronously into a rejection like any other.
    const settled = new Promise<MindmapData>((resolve) => resolve(this.handler(request, this.hostData))).then(
      (data) => this.confirm(data),
      (error: unknown) => this.reject(request, error),
    );
    return { kind: 'sent', settled };
  }

  /** Dismisses a shown rejection reason; no-op otherwise. */
  clearRejection(): void {
    if (this.currentStatus.kind === 'rejected') this.setStatus(IDLE);
  }

  /** Late host answers after disposal are ignored. */
  dispose(): void {
    this.disposed = true;
  }

  private confirm(data: MindmapData): void {
    if (this.disposed) return;
    this.hostData = data;
    this.setStatus(IDLE);
  }

  private reject(request: EditRequest, error: unknown): void {
    if (this.disposed) return;
    this.setStatus({ kind: 'rejected', request, reason: rejectionReason(error) });
  }

  private setStatus(status: EditStatus): void {
    this.currentStatus = status;
    this.onChange(status);
  }
}

function rejectionReason(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  if (typeof error === 'string' && error.trim() !== '') return error;
  return DEFAULT_REJECTION_REASON;
}
