import { nodeClickEvent } from './nodeClickEvent';

describe('nodeClickEvent', () => {
  it('GIVEN a DOM-like event with more fields WHEN built THEN only the node id and modifier keys are kept', () => {
    const domLike = { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, clientX: 12, button: 0 };
    expect(nodeClickEvent('a', domLike)).toEqual({ nodeId: 'a', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false });
  });
});
