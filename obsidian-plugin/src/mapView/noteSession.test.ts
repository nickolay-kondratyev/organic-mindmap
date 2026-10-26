import { EDIT_PROBLEM } from 'organic-mindmap';
import { noteText, readNote } from '../mindmapNote/testSupport';
import { MindmapNoteSession, NoteClosedError, STALE_EDIT_REASON, STALE_POSITIONS_REASON, type NoteTextFile } from './noteSession';

/** In-memory file with the atomic read-modify-write the session needs. */
class FakeNoteFile implements NoteTextFile {
  constructor(public text: string) {}

  async process(change: (text: string) => string): Promise<string> {
    this.text = change(this.text);
    return this.text;
  }
}

/** A file whose `process` holds the write until `finish()`: a write still in flight. */
class InFlightNoteFile implements NoteTextFile {
  private release: () => void = () => undefined;
  private readonly gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });
  private markStarted: () => void = () => undefined;
  /** Resolves once a write has started (`process` was called). */
  readonly started = new Promise<void>((resolve) => {
    this.markStarted = resolve;
  });

  constructor(public text: string) {}

  async process(change: (text: string) => string): Promise<string> {
    this.markStarted();
    await this.gate;
    this.text = change(this.text);
    return this.text;
  }

  finish(): void {
    this.release();
  }
}

const NOTE = noteText('---', 'organic-mindmap: 1', '---', '- Root ^root', '\t- Child ^c1');

describe('MindmapNoteSession', () => {
  describe('GIVEN a session loaded from a readable note and a file holding the same text', () => {
    function loaded(): { session: MindmapNoteSession; file: FakeNoteFile } {
      const session = new MindmapNoteSession();
      session.load(NOTE);
      return { session, file: new FakeNoteFile(NOTE) };
    }

    it('WHEN a child is added THEN the file text contains the new item', async () => {
      const { session, file } = loaded();
      await session.applyEdit({ type: 'add', parentId: 'root', text: 'New idea' }, file);
      expect(file.text).toContain('\t- New idea ^');
    });

    it('WHEN a child is added THEN the edit resolves with the data of the written note', async () => {
      const { session, file } = loaded();
      const { data } = await session.applyEdit({ type: 'add', parentId: 'root', text: 'New idea' }, file);
      expect(data.map((node) => node.text)).toEqual(['Root', 'Child', 'New idea']);
    });

    it('WHEN a child is added THEN the session holds the written text', async () => {
      const { session, file } = loaded();
      await session.applyEdit({ type: 'rename', nodeId: 'c1', text: 'Renamed' }, file);
      expect(session.note?.text).toBe(file.text);
    });

    it('WHEN the format refuses the edit THEN it rejects with the format reason and the file is unchanged', async () => {
      const { session, file } = loaded();
      await expect(session.applyEdit({ type: 'delete', nodeId: 'root' }, file)).rejects.toThrow(EDIT_PROBLEM.deleteRoot);
      expect(file.text).toBe(NOTE);
    });

    describe('WHEN the file changed since the map was drawn', () => {
      const changedText = noteText('---', 'organic-mindmap: 1', '---', '- Root ^root', '\t- Typed meanwhile ^c1');

      it('THEN it rejects with the stale reason', async () => {
        const { session, file } = loaded();
        file.text = changedText;
        await expect(session.applyEdit({ type: 'add', parentId: 'root', text: 'New' }, file)).rejects.toThrow(STALE_EDIT_REASON);
      });

      it('THEN the file keeps the newer text', async () => {
        const { session, file } = loaded();
        file.text = changedText;
        await session.applyEdit({ type: 'add', parentId: 'root', text: 'New' }, file).catch(() => undefined);
        expect(file.text).toBe(changedText);
      });

      it('THEN the session shows the newer text', async () => {
        const { session, file } = loaded();
        file.text = changedText;
        await session.applyEdit({ type: 'add', parentId: 'root', text: 'New' }, file).catch(() => undefined);
        expect(session.note?.toMindmapData().map((node) => node.text)).toEqual(['Root', 'Typed meanwhile']);
      });
    });
  });

  describe('GIVEN a session loaded from a note with a saved position and a file holding the same text', () => {
    const withLayout = noteText(
      '---',
      'organic-mindmap: 1',
      '---',
      '- Root ^root',
      '\t- Child ^c1',
      '\t- Other ^c2',
      '',
      '%%',
      '```organic-mindmap-layout',
      '{"c2": {"dx": 5, "dy": 6}}',
      '```',
      '%%',
    );

    function loaded(): { session: MindmapNoteSession; file: FakeNoteFile } {
      const session = new MindmapNoteSession();
      session.load(withLayout);
      return { session, file: new FakeNoteFile(withLayout) };
    }

    it('WHEN the map reports its offsets THEN the file holds exactly that set', async () => {
      const { session, file } = loaded();
      await session.savePositions({ c1: { dx: 120, dy: -40 } }, file);
      expect(readNote(file.text).positions).toEqual({ c1: { dx: 120, dy: -40 } });
    });

    it('WHEN the reported set holds an id no longer in the note THEN that id is not written', async () => {
      const { session, file } = loaded();
      await session.savePositions({ c1: { dx: 1, dy: 2 }, deletedNode: { dx: 3, dy: 4 } }, file);
      expect(readNote(file.text).positions).toEqual({ c1: { dx: 1, dy: 2 } });
    });

    it('WHEN offsets are saved THEN the session holds the written text', async () => {
      const { session, file } = loaded();
      await session.savePositions({ c1: { dx: 1, dy: 2 } }, file);
      expect(session.note?.positions).toEqual({ c1: { dx: 1, dy: 2 } });
    });

    it('WHEN two saves start together THEN the second lands too (writes run one after another)', async () => {
      const { session, file } = loaded();
      await Promise.all([session.savePositions({ c1: { dx: 1, dy: 1 } }, file), session.savePositions({ c1: { dx: 2, dy: 2 } }, file)]);
      expect(readNote(file.text).positions).toEqual({ c1: { dx: 2, dy: 2 } });
    });

    it('WHEN the file changed since the map was drawn THEN saving offsets rejects with the positions stale reason', async () => {
      const { session, file } = loaded();
      file.text = withLayout.replace('Other', 'Typed meanwhile');
      await expect(session.savePositions({ c1: { dx: 1, dy: 2 } }, file)).rejects.toThrow(STALE_POSITIONS_REASON);
    });

    it('WHEN the file changed since the map was drawn THEN saving offsets leaves the newer text', async () => {
      const { session, file } = loaded();
      const newer = withLayout.replace('Other', 'Typed meanwhile');
      file.text = newer;
      await session.savePositions({ c1: { dx: 1, dy: 2 } }, file).catch(() => undefined);
      expect(file.text).toBe(newer);
    });
  });

  describe('GIVEN a node was deleted through the session', () => {
    async function deleted(): Promise<{ session: MindmapNoteSession; file: FakeNoteFile; snapshot: { before: string; after: string } }> {
      const session = new MindmapNoteSession();
      session.load(NOTE);
      const file = new FakeNoteFile(NOTE);
      const { snapshot } = await session.applyEdit({ type: 'delete', nodeId: 'c1' }, file);
      return { session, file, snapshot };
    }

    it('WHEN it is undone THEN the file holds the text from before the delete', async () => {
      const { session, file, snapshot } = await deleted();
      await session.undo(snapshot, file);
      expect(file.text).toBe(NOTE);
    });

    it('WHEN it is undone THEN the session shows the restored node', async () => {
      const { session, file, snapshot } = await deleted();
      await session.undo(snapshot, file);
      expect(session.note?.toMindmapData().map((node) => node.id)).toEqual(['root', 'c1']);
    });

    it('WHEN it is undone THEN the result is restored', async () => {
      const { session, file, snapshot } = await deleted();
      expect(await session.undo(snapshot, file)).toBe('restored');
    });

    describe('AND the file changed after the delete', () => {
      const changedAfterDelete = noteText('---', 'organic-mindmap: 1', '---', '- Root edited elsewhere ^root');

      it('WHEN it is undone THEN the result says the file changed since', async () => {
        const { session, file, snapshot } = await deleted();
        file.text = changedAfterDelete;
        expect(await session.undo(snapshot, file)).toBe('changedSince');
      });

      it('WHEN it is undone THEN the newer text stays', async () => {
        const { session, file, snapshot } = await deleted();
        file.text = changedAfterDelete;
        await session.undo(snapshot, file);
        expect(file.text).toBe(changedAfterDelete);
      });
    });
  });

  describe('GIVEN an edit still being written when the view closes the note and loads another one', () => {
    const OTHER_NOTE = noteText('---', 'organic-mindmap: 1', '---', '- Other map ^other');

    interface SwitchedMidEdit {
      readonly session: MindmapNoteSession;
      readonly file: InFlightNoteFile;
      readonly edit: Promise<unknown>;
      /** A position save the map queued behind the edit before the switch. */
      readonly queuedSave: Promise<unknown>;
    }

    async function switchedMidEdit(): Promise<SwitchedMidEdit> {
      const session = new MindmapNoteSession();
      session.load(NOTE);
      const file = new InFlightNoteFile(NOTE);
      const edit = session.applyEdit({ type: 'add', parentId: 'root', text: 'New idea' }, file);
      const queuedSave = session.savePositions({ c1: { dx: 1, dy: 2 } }, file);
      await file.started;
      session.close();
      session.load(OTHER_NOTE);
      return { session, file, edit, queuedSave };
    }

    async function finishWrites({ file, edit, queuedSave }: SwitchedMidEdit): Promise<void> {
      file.finish();
      await Promise.allSettled([edit, queuedSave]);
    }

    it('WHEN the writes finish THEN the session keeps showing the other note', async () => {
      const switched = await switchedMidEdit();
      await finishWrites(switched);
      expect(switched.session.note?.text).toBe(OTHER_NOTE);
    });

    it('WHEN the writes finish THEN the edit rejects as closed', async () => {
      const switched = await switchedMidEdit();
      await finishWrites(switched);
      await expect(switched.edit).rejects.toBeInstanceOf(NoteClosedError);
    });

    it('WHEN the writes finish THEN the queued position save rejects as closed', async () => {
      const switched = await switchedMidEdit();
      await finishWrites(switched);
      await expect(switched.queuedSave).rejects.toBeInstanceOf(NoteClosedError);
    });

    it('WHEN the writes finish THEN the queued position save did not write the file', async () => {
      const switched = await switchedMidEdit();
      await finishWrites(switched);
      expect(readNote(switched.file.text).positions).toEqual({});
    });
  });

  describe('GIVEN a session', () => {
    it('WHEN the same text is loaded twice THEN the note object is kept (same generated ids)', () => {
      const session = new MindmapNoteSession();
      const first = session.load(NOTE);
      const second = session.load(NOTE);
      expect(second).toBe(first);
    });

    it('WHEN an unreadable note is loaded THEN the state is the plain-language problem', () => {
      const session = new MindmapNoteSession();
      const state = session.load(noteText('---', 'organic-mindmap: 1', '---', 'No list here.'));
      expect(state.kind).toBe('problem');
    });

    it('WHEN an edit is applied before any note is loaded THEN it rejects', async () => {
      const session = new MindmapNoteSession();
      await expect(session.applyEdit({ type: 'add', parentId: 'root', text: 'x' }, new FakeNoteFile(NOTE))).rejects.toThrow();
    });
  });
});
