import { EditHistory, type WriteSnapshot } from './editHistory';

const TEXT_0 = 'v0';
const TEXT_1 = 'v1';
const TEXT_2 = 'v2';
const TEXT_3 = 'v3';
const FIRST: WriteSnapshot = { before: TEXT_0, after: TEXT_1 };
const SECOND: WriteSnapshot = { before: TEXT_1, after: TEXT_2 };
const THIRD: WriteSnapshot = { before: TEXT_2, after: TEXT_3 };

describe('EditHistory', () => {
  describe('GIVEN no steps', () => {
    it('WHEN undo is taken THEN there is none', () => {
      expect(new EditHistory().takeUndo()).toBeNull();
    });

    it('WHEN redo is taken THEN there is none', () => {
      expect(new EditHistory().takeRedo()).toBeNull();
    });

    it('WHEN a write left the text unchanged THEN it is not a step', () => {
      const history = new EditHistory();
      history.record({ before: TEXT_0, after: TEXT_0 });
      expect(history.takeUndo()).toBeNull();
    });
  });

  describe('GIVEN two recorded writes', () => {
    function twoSteps(): EditHistory {
      const history = new EditHistory();
      history.record(FIRST);
      history.record(SECOND);
      return history;
    }

    it('WHEN undo is taken THEN it is the latest write', () => {
      expect(twoSteps().takeUndo()).toEqual(SECOND);
    });

    it('WHEN undo is taken twice THEN the second is the earlier write', () => {
      const history = twoSteps();
      history.takeUndo();
      expect(history.takeUndo()).toEqual(FIRST);
    });

    it('WHEN a taken step is undone THEN redo gives it back', () => {
      const history = twoSteps();
      const step = history.takeUndo()!;
      history.undone(step);
      expect(history.takeRedo()).toEqual(SECOND);
    });

    it('WHEN a redone step is taken for undo again THEN it is that step', () => {
      const history = twoSteps();
      history.undone(history.takeUndo()!);
      history.redone(history.takeRedo()!);
      expect(history.takeUndo()).toEqual(SECOND);
    });

    it('WHEN a new write is recorded after an undo THEN the redo steps are gone', () => {
      const history = twoSteps();
      history.undone(history.takeUndo()!);
      history.record({ before: TEXT_1, after: TEXT_3 });
      expect(history.takeRedo()).toBeNull();
    });

    it('WHEN cleared THEN there is nothing to undo', () => {
      const history = twoSteps();
      history.clear();
      expect(history.takeUndo()).toBeNull();
    });

    it('WHEN cleared THEN there is nothing to redo', () => {
      const history = twoSteps();
      history.undone(history.takeUndo()!);
      history.clear();
      expect(history.takeRedo()).toBeNull();
    });
  });

  describe('GIVEN a move written and the positions it drops written right after', () => {
    function moveWithPositions(): EditHistory {
      const history = new EditHistory();
      history.record(FIRST);
      history.recordInLastStep(SECOND);
      return history;
    }

    it('WHEN undo is taken THEN one step spans both writes', () => {
      expect(moveWithPositions().takeUndo()).toEqual({ before: TEXT_0, after: TEXT_2 });
    });

    it('WHEN that step is taken THEN no earlier step is left', () => {
      const history = moveWithPositions();
      history.takeUndo();
      expect(history.takeUndo()).toBeNull();
    });

    it('WHEN the follow-up does not start from the text the last step left THEN it is its own step', () => {
      const history = new EditHistory();
      history.record(FIRST);
      history.recordInLastStep(THIRD);
      expect(history.takeUndo()).toEqual(THIRD);
    });

    it('WHEN there is no step to fold into THEN the follow-up is its own step', () => {
      const history = new EditHistory();
      history.recordInLastStep(FIRST);
      expect(history.takeUndo()).toEqual(FIRST);
    });

    it('WHEN the follow-up is folded in after an undo THEN the redo steps are gone', () => {
      const history = new EditHistory();
      history.record(FIRST);
      history.record(SECOND);
      history.undone(history.takeUndo()!);
      history.recordInLastStep({ before: TEXT_1, after: TEXT_3 });
      expect(history.takeRedo()).toBeNull();
    });
  });
});
