import type { EditRequest, MindmapData, NodeOffsets, NodeOffsetsChangeCause } from 'organic-mindmap';
import { MindmapNote, readMindmapNote, type NoteReadResult, type NoteWriteResult } from '../mindmapNote';
import { EditHistory, type WriteSnapshot } from './editHistory';

/** The one thing the session needs from the note's file: an atomic read-modify-write (Obsidian `vault.process`). */
export interface NoteTextFile {
  /** Calls `change` with the file's current text and saves what it returns; resolves with the saved text. */
  process(change: (text: string) => string): Promise<string>;
}

export type SessionState = { readonly kind: 'empty' } | NoteReadResult;

type WriteOutcome = NoteWriteResult | { readonly kind: 'stale'; readonly text: string };

/** Shown by the map when the note changed under it between the draw and the write. */
export const STALE_EDIT_REASON = 'The note changed since the map was drawn. The map now shows the new text; please try again.';
/** Shown when a dragged position could not be saved because the note changed under the map. */
export const STALE_POSITIONS_REASON =
  'The note changed since the map was drawn, so the new position was not saved. The map now shows the new text; please drag again.';

/**
 * A write (or undo) queued before `MindmapNoteSession.close` finished after it. It still ran against its own note's
 * file (stale-checked), but the view no longer shows that note, so callers have nothing to show for it.
 */
export class NoteClosedError extends Error {
  constructor() {
    super('The map no longer shows the note this change was for');
    this.name = 'NoteClosedError';
  }
}

/**
 * `changedSince`: the file no longer holds the text the step left (the note changed outside the map), so the step
 * would drop the newer change; the whole history is gone then. `nothing`: no step to put back.
 */
export type ReplayResult = 'restored' | 'changedSince' | 'nothing';

/** One opened note's read: the text the map was drawn from, what it reads as, and the map's undo/redo steps on it. */
class OpenNote {
  state: SessionState = { kind: 'empty' };
  readonly history = new EditHistory();
  private text: string | null = null;

  get note(): MindmapNote | null {
    return this.state.kind === 'read' ? this.state.note : null;
  }

  /** Re-reads only when the text differs, so the same text keeps the same note (and its generated ids). */
  load(text: string): SessionState {
    if (text !== this.text) {
      this.text = text;
      this.state = readMindmapNote(text);
    }
    return this.state;
  }

  readNoteAfterWrite(): MindmapNote {
    const state = this.state;
    if (state.kind !== 'read') {
      // The format writes only what it can read back; reaching this means a format bug.
      throw new Error(`The note cannot be read back after the write: ${state.kind === 'problem' ? state.problem : state.kind}`);
    }
    return state.note;
  }
}

/**
 * One open map's note: the text it was drawn from and every write back to the file. Each map view owns one, so
 * two open maps share nothing. Writes go through `NoteTextFile.process` and apply only when the file still holds
 * the text the map was drawn from (generated block ids only resolve within that read; a stale write could also
 * drop what someone typed meanwhile); otherwise the session reloads from the file's text and refuses the write.
 * Writes run one after another, so each one checks against the text the previous one left (a drop can land while
 * an edit is still being written). Undo/redo history (`EditHistory`) lives with the open note and is only touched
 * inside that queue: a step is recorded when its write lands and taken when the undo's turn comes, so an undo
 * pressed while an edit is still being written undoes that edit. `close` ends the note (history included): writes
 * queued before it still finish against that note, but never change the session again.
 */
export class MindmapNoteSession {
  private open = new OpenNote();
  /** The tail of the write queue; never rejects. */
  private writes: Promise<unknown> = Promise.resolve();

  get state(): SessionState {
    return this.open.state;
  }

  /** The note when readable, else `null`. */
  get note(): MindmapNote | null {
    return this.open.note;
  }

  /**
   * The view stopped showing this note (switched to another file, or closed). Writes already queued still run
   * against the old note's file, each stale-checked against the text the previous one left there: dropping them
   * would silently lose a drag or edit made right before the switch. Their outcome is not loaded (it would show the
   * old note's text for the next one): they reject with {@link NoteClosedError}.
   */
  close(): void {
    this.open = new OpenNote();
  }

  /** Re-reads only when the text differs, so the same text keeps the same note (and its generated ids). */
  load(text: string): SessionState {
    return this.open.load(text);
  }

  /**
   * Host side of the library's edit protocol: resolves with the data of the note as written (one undo step), rejects
   * with a plain-language reason (the format's refusal, or {@link STALE_EDIT_REASON}). After a stale refusal the
   * session already holds the file's newer text; callers show `state` again.
   */
  async applyEdit(request: EditRequest, file: NoteTextFile): Promise<MindmapData> {
    const note = await this.write((current) => current.applyEdit(request), file, STALE_EDIT_REASON, (history, snapshot) =>
      history.record(snapshot),
    );
    return note.toMindmapData();
  }

  /**
   * Saves `offsets` as the note's whole layout (what the map reports after a drop); ids not in the note are
   * dropped. A `drop` is its own undo step; the positions a `confirmedMove` drops fold into the move's step (one
   * person action, one Ctrl+Z). Rejects with {@link STALE_POSITIONS_REASON} when the note changed under the map
   * (then like `applyEdit`).
   */
  async savePositions(offsets: NodeOffsets, cause: NodeOffsetsChangeCause, file: NoteTextFile): Promise<void> {
    await this.write(
      (note) => ({ kind: 'written', text: note.setPositions(offsets) }),
      file,
      STALE_POSITIONS_REASON,
      (history, snapshot) => (cause === 'confirmedMove' ? history.recordInLastStep(snapshot) : history.record(snapshot)),
    );
  }

  /** Puts back the text from before the latest step, only while the file still holds the text that step left. */
  undo(file: NoteTextFile): Promise<ReplayResult> {
    return this.replay(file, {
      take: (history) => history.takeUndo(),
      textOf: (step) => ({ expected: step.after, replacement: step.before }),
      landed: (history, step) => history.undone(step),
    });
  }

  /** Puts back the text the latest undone step left, only while the file still holds the text from before it. */
  redo(file: NoteTextFile): Promise<ReplayResult> {
    return this.replay(file, {
      take: (history) => history.takeRedo(),
      textOf: (step) => ({ expected: step.before, replacement: step.after }),
      landed: (history, step) => history.redone(step),
    });
  }

  /**
   * One undo or redo, queued like a write: takes the step when its turn comes (so every earlier write is recorded),
   * swaps its text only while the file holds exactly the expected one, else drops the history (every step builds on
   * the text the previous one left).
   */
  private replay(
    file: NoteTextFile,
    direction: {
      take: (history: EditHistory) => WriteSnapshot | null;
      textOf: (step: WriteSnapshot) => { expected: string; replacement: string };
      landed: (history: EditHistory, step: WriteSnapshot) => void;
    },
  ): Promise<ReplayResult> {
    return this.enqueue(async (open) => {
      const step = direction.take(open.history);
      if (step === null) return 'nothing';
      const { expected, replacement } = direction.textOf(step);
      const text = await file.process((fileText) => (fileText === expected ? replacement : fileText));
      open.load(text);
      if (text !== replacement) {
        open.history.clear();
        return 'changedSince';
      }
      direction.landed(open.history, step);
      return 'restored';
    });
  }

  /**
   * One stale-checked `process`; resolves with the note as written (after `record` put it in the history), else
   * rejects with the reason. A stale write means the note changed outside the map: the history is dropped.
   */
  private write(
    change: (note: MindmapNote) => NoteWriteResult,
    file: NoteTextFile,
    staleReason: string,
    record: (history: EditHistory, snapshot: WriteSnapshot) => void,
  ): Promise<MindmapNote> {
    return this.enqueue(async (open) => {
      const note = open.note;
      if (note === null) throw new Error('The map has no readable note to change');
      // A property, not a `let`: TypeScript does not see assignments made inside the callback.
      const seen: { outcome: WriteOutcome | null } = { outcome: null };
      await file.process((fileText) => {
        if (fileText !== note.text) {
          seen.outcome = { kind: 'stale', text: fileText };
          return fileText;
        }
        const result = change(note);
        seen.outcome = result;
        return result.kind === 'written' ? result.text : fileText;
      });
      // `process` always calls `change` before resolving; `null` here is a broken file store, not a user error.
      if (seen.outcome === null) throw new Error('The file store resolved without reading the note');
      switch (seen.outcome.kind) {
        case 'written':
          open.load(seen.outcome.text);
          record(open.history, { before: note.text, after: seen.outcome.text });
          return open.readNoteAfterWrite();
        case 'refused':
          throw new Error(seen.outcome.reason);
        case 'stale':
          open.load(seen.outcome.text);
          open.history.clear();
          throw new Error(staleReason);
      }
    });
  }

  /**
   * Queues `task` against the note open now (its `OpenNote` keeps tracking that note's text even after `close`).
   * If the session closed meanwhile, the caller gets {@link NoteClosedError} instead of the task's outcome.
   */
  private enqueue<T>(task: (open: OpenNote) => Promise<T>): Promise<T> {
    const open = this.open;
    const closedSince = (): boolean => open !== this.open;
    const run = this.writes
      .then(() => task(open))
      .then(
        (value) => {
          if (closedSince()) throw new NoteClosedError();
          return value;
        },
        (error: unknown) => {
          throw closedSince() ? new NoteClosedError() : error;
        },
      );
    this.writes = run.catch(() => undefined);
    return run;
  }
}
