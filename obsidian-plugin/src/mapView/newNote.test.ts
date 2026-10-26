import { newMindmapNoteFileName, newNotePath } from './newNote';

describe('newMindmapNoteFileName', () => {
  it('GIVEN a time THEN the name has the local timestamp, zero-padded, and the mindmap suffix', () => {
    expect(newMindmapNoteFileName(new Date(2026, 0, 5, 9, 7, 3))).toBe('Mindmap 2026-01-05 09.07.03.organic-mindmap.md');
  });
});

describe('newNotePath', () => {
  it('GIVEN the vault root as "/" THEN the path is just the file name', () => {
    expect(newNotePath('/', 'Map.md')).toBe('Map.md');
  });

  it('GIVEN a folder THEN the path joins folder and file name', () => {
    expect(newNotePath('Inbox/Maps', 'Map.md')).toBe('Inbox/Maps/Map.md');
  });
});
