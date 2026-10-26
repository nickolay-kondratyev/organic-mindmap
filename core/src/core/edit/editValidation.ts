import type { MindmapData, NodeId } from '../model/node';
import { buildTree, type MindmapTree } from '../model/tree';
import type { EditRequest } from './editRequest';

/** Plain-language reasons (spec I5.4 wording style), exported so UIs and tests can match them. */
export const EDIT_PROBLEM = {
  unknownNode: 'That node no longer exists.',
  moveOntoSelf: 'A node cannot be dropped onto itself.',
  moveIntoOwnBranch: 'A node cannot be dropped onto one of its own children.',
  deleteRoot: 'The central topic cannot be deleted.',
} as const;

/**
 * Returns why `request` cannot be applied to `data`, or `null` when it can. Checked by the library before
 * anything is sent (spec I3: self/descendant drops are refused up front) and by the in-memory host.
 */
export function findEditProblem(data: MindmapData, request: EditRequest): string | null {
  const tree = buildTree(data);
  switch (request.type) {
    case 'move':
      if (!hasNodes(tree, request.nodeId, request.newParentId)) return EDIT_PROBLEM.unknownNode;
      if (request.nodeId === request.newParentId) return EDIT_PROBLEM.moveOntoSelf;
      // Also covers moving the root: every other node is its descendant.
      if (tree.isAncestor(request.nodeId, request.newParentId)) return EDIT_PROBLEM.moveIntoOwnBranch;
      return null;
    case 'add':
      return hasNodes(tree, request.parentId) ? null : EDIT_PROBLEM.unknownNode;
    case 'rename':
      return hasNodes(tree, request.nodeId) ? null : EDIT_PROBLEM.unknownNode;
    case 'delete':
      if (!hasNodes(tree, request.nodeId)) return EDIT_PROBLEM.unknownNode;
      return request.nodeId === tree.root.id ? EDIT_PROBLEM.deleteRoot : null;
  }
}

function hasNodes(tree: MindmapTree, ...ids: NodeId[]): boolean {
  const known = new Set(tree.nodes.map((node) => node.id));
  return ids.every((id) => known.has(id));
}
