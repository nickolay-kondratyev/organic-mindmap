import type { MindmapData, MindmapNode, NodeId } from '../model/node';
import { buildTree, type MindmapTree } from '../model/tree';
import type { AddEditRequest, EditRequest } from './editRequest';

/**
 * Pure application of an edit to a data snapshot, returning new data (input is never mutated).
 * Used by the in-memory host to really apply a request, and by the edit session to build the pending preview.
 * Requests that `findEditProblem` would refuse are a caller error: unknown ids are left untouched.
 */
export function applyEdit(data: MindmapData, request: EditRequest, newNodeId: NodeId): MindmapData {
  switch (request.type) {
    case 'move':
      return data.map((node) => (node.id === request.nodeId ? { ...node, parentId: request.newParentId } : node));
    case 'rename':
      return data.map((node) => (node.id === request.nodeId ? { ...node, text: request.text } : node));
    case 'add':
      return [...data, newChildNode(newNodeId, request)];
    case 'delete': {
      const removed = subtreeIds(buildTree(data), request.nodeId);
      return data.filter((node) => !removed.has(node.id));
    }
  }
}

/** Ids of `rootId` and all its descendants. */
function subtreeIds(tree: MindmapTree, rootId: NodeId): Set<NodeId> {
  const ids = new Set<NodeId>();
  const stack: NodeId[] = [rootId];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    ids.add(id);
    for (const child of tree.childrenOf(id)) stack.push(child.id);
  }
  return ids;
}

function newChildNode(id: NodeId, request: AddEditRequest): MindmapNode {
  const node: MindmapNode = { id, parentId: request.parentId, text: request.text };
  // exactOptionalPropertyTypes: only set `side` when the request carries one.
  return request.side === undefined ? node : { ...node, side: request.side };
}
