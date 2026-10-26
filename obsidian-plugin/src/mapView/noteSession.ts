import type { EditRequest, MindmapData } from 'organic-mindmap';
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

/**
 * One open map's note: the text it was drawn from and every write back to the file. Each map view owns one, so
 * two open maps share nothing. Writes go through `NoteTextFile.process` and apply only when the file still holds
 * the text the map was drawn from (generated block ids only resolve within that read; a stale write could also
 * drop what someone typed meanwhile); otherwise the session reloads from the file's text and refuses the edit.
 */
export class MindmapNoteSession {
  private current: SessionState = { kind: 'empty' };
  private text: string | null = null;

  get state(): SessionState {
    return this.current;
  }

  /** The note when readable, else `null`. */
  get note(): MindmapNote | null {
    return this.current.kind === 'read' ? this.current.note : null;
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
   * Host side of the library's edit protocol: resolves with the data of the note as written, rejects with a
   * plain-language reason (the format's refusal, or {@link STALE_EDIT_REASON}). After a stale refusal the session
   * already holds the file's newer text; callers show `state` again.
   */
  async applyEdit(request: EditRequest, file: NoteTextFile): Promise<MindmapData> {
    const note = this.note;
    if (note === null) throw new Error('The map has no readable note to change');
    // A property, not a `let`: TypeScript does not see assignments made inside the callback.
    const seen: { outcome: WriteOutcome | null } = { outcome: null };
    await file.process((fileText) => {
      if (fileText !== note.text) {
        seen.outcome = { kind: 'stale', text: fileText };
        return fileText;
      }
      const result = note.applyEdit(request);
      seen.outcome = result;
      return result.kind === 'written' ? result.text : fileText;
    });
    // `process` always calls `change` before resolving; `null` here is a broken file store, not a user error.
    if (seen.outcome === null) throw new Error('The file store resolved without reading the note');
    switch (seen.outcome.kind) {
      case 'written':
        return this.dataAfterWrite(seen.outcome.text);
      case 'refused':
        throw new Error(seen.outcome.reason);
      case 'stale':
        this.load(seen.outcome.text);
        throw new Error(STALE_EDIT_REASON);
    }
  }

  private dataAfterWrite(text: string): MindmapData {
    const state = this.load(text);
    if (state.kind !== 'read') {
      // The format writes only what it can read back; reaching this means a format bug.
      throw new Error(`The note cannot be read back after the write: ${state.kind === 'problem' ? state.problem : state.kind}`);
    }
    return state.note.toMindmapData();
  }
}
