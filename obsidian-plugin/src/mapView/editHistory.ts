import type { WriteSnapshot } from './noteSession';

/**
 * Undo/redo history of one map view's writes to its note: two stacks of before/after note texts. One step is one
 * person action; a follow-up write that belongs to the same action (the positions a confirmed move drops) folds
 * into the step through `recordInLastStep`. The stale rule lives in the session (`undo`/`redo` check the file still
 * holds the text the step left); when that fails the view calls `clear`, since every later step builds on that text.
 * Steps are taken off the stack when the key is pressed, not when the write lands, so two quick Ctrl+Z take two
 * different steps even though their writes still queue behind each other.
 */
export class EditHistory {
  private undoSteps: WriteSnapshot[] = [];
  private redoSteps: WriteSnapshot[] = [];

  /** A new map change: a new step, and the redo steps no longer apply. A write that left the text as it was is not a step. */
  record(snapshot: WriteSnapshot): void {
    this.redoSteps = [];
    if (snapshot.before === snapshot.after) return;
    this.undoSteps.push(snapshot);
  }

  /**
   * A write that belongs to the same person action as the last step (it starts from the text that step left):
   * one Ctrl+Z undoes both. Anything else is recorded as its own step.
   */
  recordInLastStep(snapshot: WriteSnapshot): void {
    const last = this.undoSteps.at(-1);
    if (last === undefined || last.after !== snapshot.before) {
      this.record(snapshot);
      return;
    }
    this.redoSteps = [];
    this.undoSteps[this.undoSteps.length - 1] = { before: last.before, after: snapshot.after };
  }

  /** Takes the step Ctrl+Z puts back; `null` when there is none. Call `undone` once the file holds its `before`. */
  takeUndo(): WriteSnapshot | null {
    return this.undoSteps.pop() ?? null;
  }

  /** Takes the step Ctrl+Shift+Z puts back; `null` when there is none. Call `redone` once the file holds its `after`. */
  takeRedo(): WriteSnapshot | null {
    return this.redoSteps.pop() ?? null;
  }

  undone(step: WriteSnapshot): void {
    this.redoSteps.push(step);
  }

  redone(step: WriteSnapshot): void {
    this.undoSteps.push(step);
  }

  /** The note changed outside the map (or the view shows another note): no step applies any more. */
  clear(): void {
    this.undoSteps = [];
    this.redoSteps = [];
  }
}
