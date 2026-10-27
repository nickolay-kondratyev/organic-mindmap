import type { EditRequest, MindmapData, NodeOffsets } from 'organic-mindmap';
import { MindmapNote, readMindmapNote, type NoteReadResult, type NoteWriteResult } from '../mindmapNote';

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

/** The note text right before and right after one write, to undo exactly that write. */
export interface WriteSnapshot {
  readonly before: string;
  readonly after: string;
}

/** A confirmed map edit: what the map shows now, and how to undo it. */
export interface WrittenEdit {
  readonly data: MindmapData;
  readonly snapshot: WriteSnapshot;
}

/** `changedSince`: the file no longer holds the text the write left, so undo would drop the newer change. */
export type UndoResult = 'restored' | 'changedSince';

/** One opened note's read: the text the map was drawn from and what it reads as. */
class OpenNote {
  state: SessionState = { kind: 'empty' };
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

/** A confirmed write: the note as written, and how to undo it. */
interface WrittenNote {
  readonly note: MindmapNote;
  readonly snapshot: WriteSnapshot;
}

/**
 * One open map's note: the text it was drawn from and every write back to the file. Each map view owns one, so
 * two open maps share nothing. Writes go through `NoteTextFile.process` and apply only when the file still holds
 * the text the map was drawn from (generated block ids only resolve within that read; a stale write could also
 * drop what someone typed meanwhile); otherwise the session reloads from the file's text and refuses the write.
 * Writes run one after another, so each one checks against the text the previous one left (a drop can land while
 * an edit is still being written). `close` ends the note: writes queued before it still finish against that note,
 * but never change the session again.
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
   * Host side of the library's edit protocol: resolves with the data of the note as written (and the snapshot to
   * undo it), rejects with a plain-language reason (the format's refusal, or {@link STALE_EDIT_REASON}). After a
   * stale refusal the session already holds the file's newer text; callers show `state` again.
   */
  async applyEdit(request: EditRequest, file: NoteTextFile): Promise<WrittenEdit> {
    const { note, snapshot } = await this.write((current) => current.applyEdit(request), file, STALE_EDIT_REASON);
    return { data: note.toMindmapData(), snapshot };
  }

  /**
   * Saves `offsets` as the note's whole layout (what the map reports after a drop); ids not in the note are
   * dropped. Resolves with the snapshot to undo it (`before === after` when the note already held these positions).
   * Rejects with {@link STALE_POSITIONS_REASON} when the note changed under the map (then like `applyEdit`).
   */
  async savePositions(offsets: NodeOffsets, file: NoteTextFile): Promise<WriteSnapshot> {
    const { snapshot } = await this.write((note) => ({ kind: 'written', text: note.setPositions(offsets) }), file, STALE_POSITIONS_REASON);
    return snapshot;
  }

  /** Puts back the text from before `snapshot`'s write, only while the file still holds the text it left. */
  undo(snapshot: WriteSnapshot, file: NoteTextFile): Promise<UndoResult> {
    return this.swapText(snapshot.after, snapshot.before, file);
  }

  /** Puts back the text `snapshot`'s write left, only while the file still holds the text from before it (an undone step). */
  redo(snapshot: WriteSnapshot, file: NoteTextFile): Promise<UndoResult> {
    return this.swapText(snapshot.before, snapshot.after, file);
  }

  /** Replaces `expected` with `replacement` in the file, only while the file holds exactly `expected`. */
  private swapText(expected: string, replacement: string, file: NoteTextFile): Promise<UndoResult> {
    return this.enqueue(async (open) => {
      const text = await file.process((fileText) => (fileText === expected ? replacement : fileText));
      open.load(text);
      return text === replacement ? 'restored' : 'changedSince';
    });
  }

  /** One stale-checked `process`; resolves with the note as written, else rejects with the reason. */
  private write(change: (note: MindmapNote) => NoteWriteResult, file: NoteTextFile, staleReason: string): Promise<WrittenNote> {
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
          return { note: open.readNoteAfterWrite(), snapshot: { before: note.text, after: seen.outcome.text } };
        case 'refused':
          throw new Error(seen.outcome.reason);
        case 'stale':
          open.load(seen.outcome.text);
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
