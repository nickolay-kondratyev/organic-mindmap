import { EDIT_PROBLEM } from 'organic-mindmap';
import { noteText } from '../mindmapNote/testSupport';
import { MindmapNoteSession, STALE_EDIT_REASON, type NoteTextFile } from './noteSession';

/** In-memory file with the atomic read-modify-write the session needs. */
class FakeNoteFile implements NoteTextFile {
  constructor(public text: string) {}

  async process(change: (text: string) => string): Promise<string> {
    this.text = change(this.text);
    return this.text;
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
      const data = await session.applyEdit({ type: 'add', parentId: 'root', text: 'New idea' }, file);
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
