import { REFERENCE_DATA, type NodeClickEvent } from 'natural-mindmap';
import { describeNodeClick } from './nodeClickReadout';

const PLAIN_CLICK: NodeClickEvent = { nodeId: 'hamlet', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };

describe('GIVEN a click on Hamlet in the reference data', () => {
  it('WHEN no modifier is held THEN it reads as the node label', () => {
    expect(describeNodeClick(PLAIN_CLICK, REFERENCE_DATA)).toBe('Hamlet');
  });

  it('WHEN Ctrl and Shift are held THEN they are listed after the label', () => {
    expect(describeNodeClick({ ...PLAIN_CLICK, ctrlKey: true, shiftKey: true }, REFERENCE_DATA)).toBe('Hamlet (Ctrl+Shift)');
  });

  it('WHEN the node is no longer in the data THEN it reads as the node id', () => {
    expect(describeNodeClick(PLAIN_CLICK, [])).toBe('hamlet');
  });
});
