import type { MindmapData, NodeId, Side } from '../model/node';

/**
 * Typed structural edit requests (spec I5.1). The library never applies these to host data itself (L2);
 * it sends them to the host's `EditHandler` and renders whatever data the host confirms with.
 */
export type EditRequest = MoveEditRequest | AddEditRequest | RenameEditRequest | DeleteEditRequest;

/** Reparent `nodeId` (with its subtree) under `newParentId` (spec I3). */
export interface MoveEditRequest {
  readonly type: 'move';
  readonly nodeId: NodeId;
  readonly newParentId: NodeId;
}

/** Add a child under `parentId`; the host picks the new node's id (e.g. a file path). */
export interface AddEditRequest {
  readonly type: 'add';
  readonly parentId: NodeId;
  readonly text: string;
  /** Only meaningful when adding a first-level node (child of the root). */
  readonly side?: Side;
}

export interface RenameEditRequest {
  readonly type: 'rename';
  readonly nodeId: NodeId;
  readonly text: string;
}

/** Delete `nodeId` and its whole subtree. Undo is the host's job (spec I4). */
export interface DeleteEditRequest {
  readonly type: 'delete';
  readonly nodeId: NodeId;
}

/**
 * Host side of the request -> confirm protocol (spec I5). Resolve with the host's updated data once the
 * change is really applied (e.g. the file was moved); reject (ideally with an `Error` whose message is a
 * plain-language reason) when it was not. `currentData` is the confirmed data the request was made against,
 * handy for hosts that keep no state of their own (like the in-memory host).
 * The host must always settle the promise: there is no library-side timeout.
 */
export type EditHandler = (request: EditRequest, currentData: MindmapData) => Promise<MindmapData>;
