import type { MindmapData } from '../model/node';
import { EDIT_PROBLEM, findEditProblem } from './editValidation';

describe('findEditProblem', () => {
  // GIVEN root -> a -> a1, root -> b
  const data: MindmapData = [
    { id: 'root', parentId: null, text: 'R' },
    { id: 'a', parentId: 'root', text: 'A' },
    { id: 'a1', parentId: 'a', text: 'A1' },
    { id: 'b', parentId: 'root', text: 'B' },
  ];

  it('WHEN dropping a node onto itself THEN it is refused', () => {
    expect(findEditProblem(data, { type: 'move', nodeId: 'a', newParentId: 'a' })).toBe(EDIT_PROBLEM.moveOntoSelf);
  });

  it('WHEN dropping a node onto its own descendant THEN it is refused', () => {
    expect(findEditProblem(data, { type: 'move', nodeId: 'a', newParentId: 'a1' })).toBe(EDIT_PROBLEM.moveIntoOwnBranch);
  });

  it('WHEN dropping the root onto any node THEN it is refused', () => {
    expect(findEditProblem(data, { type: 'move', nodeId: 'root', newParentId: 'b' })).toBe(EDIT_PROBLEM.moveIntoOwnBranch);
  });

  it('WHEN dropping a node onto an unrelated node THEN it is allowed', () => {
    expect(findEditProblem(data, { type: 'move', nodeId: 'a', newParentId: 'b' })).toBeNull();
  });

  it('WHEN a request names an unknown node THEN it is refused', () => {
    expect(findEditProblem(data, { type: 'rename', nodeId: 'ghost', text: 'X' })).toBe(EDIT_PROBLEM.unknownNode);
  });

  it('WHEN adding under an unknown parent THEN it is refused', () => {
    expect(findEditProblem(data, { type: 'add', parentId: 'ghost', text: 'X' })).toBe(EDIT_PROBLEM.unknownNode);
  });

  it('WHEN deleting the root THEN it is refused', () => {
    expect(findEditProblem(data, { type: 'delete', nodeId: 'root' })).toBe(EDIT_PROBLEM.deleteRoot);
  });

  it('WHEN deleting a regular node THEN it is allowed', () => {
    expect(findEditProblem(data, { type: 'delete', nodeId: 'a' })).toBeNull();
  });
});
