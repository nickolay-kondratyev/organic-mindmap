import type { Point } from '../model/node';
import type { NodeHandle } from './hitTest';
import { clickedNodeId, DRAG_THRESHOLD_PX, exceedsDragThreshold, PointerGesture, type PressTarget } from './pointerGesture';

const START: Point = { x: 100, y: 100 };
const WITHIN: Point = { x: START.x + DRAG_THRESHOLD_PX - 1, y: START.y };
const BEYOND: Point = { x: START.x + DRAG_THRESHOLD_PX + 6, y: START.y + 2 };
const FURTHER: Point = { x: BEYOND.x + 5, y: BEYOND.y + 7 };
const NODE: PressTarget = { kind: 'node', nodeId: 'a' };
const CANVAS: PressTarget = { kind: 'canvas' };
const ROOT: PressTarget = { kind: 'fixed-node', nodeId: 'root' };
const HANDLE: NodeHandle = { kind: 'add-child', nodeId: 'a', side: 'right', center: START };
const BUTTON: PressTarget = { kind: 'handle', handle: HANDLE };

describe('exceedsDragThreshold', () => {
  it('WHEN the pointer moved exactly the threshold THEN it is not a drag yet', () => {
    expect(exceedsDragThreshold(START, { x: START.x, y: START.y + DRAG_THRESHOLD_PX })).toBe(false);
  });

  it('WHEN the pointer moved diagonally past the threshold THEN it is a drag', () => {
    expect(exceedsDragThreshold(START, { x: START.x + DRAG_THRESHOLD_PX, y: START.y + 1 })).toBe(true);
  });
});

describe('PointerGesture', () => {
  let gesture: PointerGesture;
  beforeEach(() => {
    gesture = new PointerGesture();
  });

  describe('GIVEN a press on a node', () => {
    beforeEach(() => gesture.press(START, NODE));

    it('WHEN moving within the threshold THEN nothing happens', () => {
      expect(gesture.move(WITHIN)).toEqual({ kind: 'none' });
    });

    it('WHEN released after jitter within the threshold THEN it is a click on the node', () => {
      gesture.move(WITHIN);
      expect(gesture.release(WITHIN)).toEqual({ kind: 'click', target: NODE });
    });

    it('WHEN moving past the threshold THEN the node drags by the full offset from the press', () => {
      expect(gesture.move(BEYOND)).toEqual({ kind: 'drag', nodeId: 'a', offset: { x: BEYOND.x - START.x, y: BEYOND.y - START.y } });
    });

    it('WHEN dragged back inside the threshold THEN it keeps dragging', () => {
      gesture.move(BEYOND);
      expect(gesture.move(WITHIN).kind).toBe('drag');
    });

    it('WHEN released after dragging THEN the drag ends at the release offset', () => {
      gesture.move(BEYOND);
      expect(gesture.release(FURTHER)).toEqual({ kind: 'drag-end', nodeId: 'a', offset: { x: FURTHER.x - START.x, y: FURTHER.y - START.y } });
    });

    it('WHEN cancelled mid-drag THEN the release ends nothing', () => {
      gesture.move(BEYOND);
      gesture.cancel();
      expect(gesture.release(FURTHER)).toEqual({ kind: 'none' });
    });
  });

  describe('GIVEN a press on empty canvas', () => {
    beforeEach(() => gesture.press(START, CANVAS));

    it('WHEN first moving past the threshold THEN it pans by the whole distance so far', () => {
      expect(gesture.move(BEYOND)).toEqual({ kind: 'pan', delta: { x: BEYOND.x - START.x, y: BEYOND.y - START.y } });
    });

    it('WHEN moving again THEN it pans by the delta since the previous move', () => {
      gesture.move(BEYOND);
      expect(gesture.move(FURTHER)).toEqual({ kind: 'pan', delta: { x: FURTHER.x - BEYOND.x, y: FURTHER.y - BEYOND.y } });
    });

    it('WHEN released after panning THEN it is not a click', () => {
      gesture.move(BEYOND);
      expect(gesture.release(BEYOND)).toEqual({ kind: 'none' });
    });
  });

  describe('GIVEN a press on a node that cannot move', () => {
    beforeEach(() => gesture.press(START, ROOT));

    it('WHEN released in place THEN it is a click on the node', () => {
      expect(gesture.release(START)).toEqual({ kind: 'click', target: ROOT });
    });

    it('WHEN moving past the threshold THEN it pans instead of dragging the node', () => {
      expect(gesture.move(BEYOND).kind).toBe('pan');
    });
  });

  describe('GIVEN a press on a hover button', () => {
    beforeEach(() => gesture.press(START, BUTTON));

    it('WHEN released in place THEN the button is clicked', () => {
      expect(gesture.release(START)).toEqual({ kind: 'click', target: BUTTON });
    });

    it('WHEN the pointer wanders past the threshold THEN it neither pans nor drags', () => {
      expect(gesture.move(BEYOND)).toEqual({ kind: 'none' });
    });

    it('WHEN released after wandering off THEN the button is not clicked', () => {
      gesture.move(BEYOND);
      expect(gesture.release(START)).toEqual({ kind: 'none' });
    });
  });

  it('GIVEN a press WHEN released past the threshold without a move event THEN it is not a click', () => {
    gesture.press(START, NODE);
    expect(gesture.release(BEYOND)).toEqual({ kind: 'none' });
  });
});

describe('clickedNodeId', () => {
  it('GIVEN a click on a movable node THEN it reports that node', () => {
    expect(clickedNodeId(NODE)).toBe('a');
  });

  it('GIVEN a click on a node that cannot move THEN it reports that node', () => {
    expect(clickedNodeId(ROOT)).toBe('root');
  });

  it('GIVEN a click on a hover button THEN it reports no node', () => {
    expect(clickedNodeId(BUTTON)).toBeNull();
  });

  it('GIVEN a click on bare canvas THEN it reports no node', () => {
    expect(clickedNodeId(CANVAS)).toBeNull();
  });
});
