import { isMindmapNote, newMindmapNoteText } from './frontmatter';
import { readMindmapNote } from './readMindmapNote';

describe('isMindmapNote', () => {
  it('GIVEN the flag among other frontmatter keys WHEN checking THEN it is a mindmap note', () => {
    expect(isMindmapNote('---\ntags: [x]\norganic-mindmap: 1\n---\n- root\n')).toBe(true);
  });

  it('GIVEN a quoted flag and CRLF line breaks WHEN checking THEN it is a mindmap note', () => {
    expect(isMindmapNote('---\r\norganic-mindmap: "1"\r\n---\r\n- root\r\n')).toBe(true);
  });

  it('GIVEN no frontmatter WHEN checking THEN it is not a mindmap note', () => {
    expect(isMindmapNote('organic-mindmap: 1\n- root\n')).toBe(false);
  });

  it('GIVEN another format version WHEN checking THEN it is not a mindmap note', () => {
    expect(isMindmapNote('---\norganic-mindmap: 2\n---\n')).toBe(false);
  });

  it('GIVEN the flag only in the body WHEN checking THEN it is not a mindmap note', () => {
    expect(isMindmapNote('---\ntitle: x\n---\norganic-mindmap: 1\n')).toBe(false);
  });

  it('GIVEN an unclosed frontmatter WHEN checking THEN it is not a mindmap note', () => {
    expect(isMindmapNote('---\norganic-mindmap: 1\n- root\n')).toBe(false);
  });
});

describe('newMindmapNoteText', () => {
  const text = newMindmapNoteText('Project Phoenix');

  it('WHEN creating THEN it is the flag and one root item', () => {
    expect(text).toBe('---\norganic-mindmap: 1\n---\n- Project Phoenix ^root\n');
  });

  it('WHEN checking the template THEN it is a mindmap note', () => {
    expect(isMindmapNote(text)).toBe(true);
  });

  it('WHEN reading the template THEN it is a map with only the root', () => {
    const result = readMindmapNote(text);
    expect(result.kind === 'read' && result.note.toMindmapData()).toEqual([
      { id: 'root', parentId: null, text: 'Project Phoenix' },
    ]);
  });
});
