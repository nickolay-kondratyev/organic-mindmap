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
 * A write (or undo) that started before `MindmapNoteSession.close` and so belongs to a note the view no longer shows:
 * its outcome was not loaded. Callers have nothing to show for it.
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

/**
 * One open map's note: the text it was drawn from and every write back to the file. Each map view owns one, so
 * two open maps share nothing. Writes go through `NoteTextFile.process` and apply only when the file still holds
 * the text the map was drawn from (generated block ids only resolve within that read; a stale write could also
 * drop what someone typed meanwhile); otherwise the session reloads from the file's text and refuses the write.
 * Writes run one after another, so each one checks against the text the previous one left (a drop can land while
 * an edit is still being written). `close` ends the note: writes started before it never change the session again.
 */
export class MindmapNoteSession {
  private current: SessionState = { kind: 'empty' };
  private text: string | null = null;
  /** The tail of the write queue; never rejects. */
  private writes: Promise<unknown> = Promise.resolve();
  /** Counts `close` calls: a write started under an older count belongs to a note the session no longer holds. */
  private closes = 0;

  get state(): SessionState {
    return this.current;
  }

  /** The note when readable, else `null`. */
  get note(): MindmapNote | null {
    return this.current.kind === 'read' ? this.current.note : null;
  }

  /**
   * The view stopped showing this note (switched to another file, or closed). Writes still queued or in flight then
   * reject with {@link NoteClosedError} instead of loading their outcome, which would show the old note's text for
   * the next one. A queued write that had not started yet is dropped: it would check against a note the session
   * no longer holds.
   */
  close(): void {
    this.closes++;
    this.current = { kind: 'empty' };
    this.text = null;
  }

  /** Re-reads only when the text differs, so the same text keeps the same note (and its generated ids). */
  load(text: string): SessionState {
    if (text !== this.text) {
      this.text = text;
      this.current = readMindmapNote(text);
    }
    return this.current;
  }

  /**
   * Host side of the library's edit protocol: resolves with the data of the note as written (and the snapshot to
   * undo it), rejects with a plain-language reason (the format's refusal, or {@link STALE_EDIT_REASON}). After a
   * stale refusal the session already holds the file's newer text; callers show `state` again.
   */
  async applyEdit(request: EditRequest, file: NoteTextFile): Promise<WrittenEdit> {
    const snapshot = await this.write((note) => note.applyEdit(request), file, STALE_EDIT_REASON);
    return { data: this.readNoteAfterWrite().toMindmapData(), snapshot };
  }

  /**
   * Saves `offsets` as the note's whole layout (what the map reports after a drop); ids not in the note are
   * dropped. Rejects with {@link STALE_POSITIONS_REASON} when the note changed under the map (then like `applyEdit`).
   */
  async savePositions(offsets: NodeOffsets, file: NoteTextFile): Promise<void> {
    await this.write((note) => ({ kind: 'written', text: note.setPositions(offsets) }), file, STALE_POSITIONS_REASON);
    this.readNoteAfterWrite();
  }

  /** Puts back the text from before `snapshot`'s write, only while the file still holds the text it left. */
  undo(snapshot: WriteSnapshot, file: NoteTextFile): Promise<UndoResult> {
    return this.enqueue(async (stillOpen) => {
      stillOpen();
      const text = await file.process((fileText) => (fileText === snapshot.after ? snapshot.before : fileText));
      stillOpen();
      this.load(text);
      return text === snapshot.before ? 'restored' : 'changedSince';
    });
  }

  /** One stale-checked `process`; resolves with the before/after texts, else rejects with the reason. */
  private write(change: (note: MindmapNote) => NoteWriteResult, file: NoteTextFile, staleReason: string): Promise<WriteSnapshot> {
    return this.enqueue(async (stillOpen) => {
      stillOpen();
      const note = this.note;
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
      stillOpen();
      switch (seen.outcome.kind) {
        case 'written':
          this.load(seen.outcome.text);
          return { before: note.text, after: seen.outcome.text };
        case 'refused':
          throw new Error(seen.outcome.reason);
        case 'stale':
          this.load(seen.outcome.text);
          throw new Error(staleReason);
      }
    });
  }

  /** Queues `task`; its `stillOpen` throws {@link NoteClosedError} once the session closed after the enqueue. */
  private enqueue<T>(task: (stillOpen: () => void) => Promise<T>): Promise<T> {
    const closesAtEnqueue = this.closes;
    const stillOpen = (): void => {
      if (this.closes !== closesAtEnqueue) throw new NoteClosedError();
    };
    const run = this.writes.then(() => task(stillOpen));
    this.writes = run.catch(() => undefined);
    return run;
  }

  private readNoteAfterWrite(): MindmapNote {
    const state = this.current;
    if (state.kind !== 'read') {
      // The format writes only what it can read back; reaching this means a format bug.
      throw new Error(`The note cannot be read back after the write: ${state.kind === 'problem' ? state.problem : state.kind}`);
    }
    return state.note;
  }
}
