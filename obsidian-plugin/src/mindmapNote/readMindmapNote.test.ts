import { NOTE_PROBLEM } from './readMindmapNote';
import { noteText, readNote, readProblem } from './testSupport';

describe('readMindmapNote', () => {
  describe('GIVEN the example note from the format spec', () => {
    const text = noteText(
      '---',
      'organic-mindmap: 1',
      '---',
      '- Project Phoenix ^root',
      '\t- [[Some note]] ^n7f3k',
      '\t\t- plain idea ^n9a2b',
      '',
      '%%',
      '```organic-mindmap-layout',
      '{"n7f3k": {"dx": 120, "dy": -40}}',
      '```',
      '%%',
    );

    it('WHEN reading THEN the list is the tree with labels as shown', () => {
      expect(readNote(text).toMindmapData()).toEqual([
        { id: 'root', parentId: null, text: 'Project Phoenix' },
        { id: 'n7f3k', parentId: 'root', text: 'Some note' },
        { id: 'n9a2b', parentId: 'n7f3k', text: 'plain idea' },
      ]);
    });

    it('WHEN reading THEN the raw item text is kept for opening the link', () => {
      expect(readNote(text).nodes[1]?.rawText).toBe('[[Some note]]');
    });

    it('WHEN reading THEN the saved offsets are keyed by block id', () => {
      expect(readNote(text).positions).toEqual({ n7f3k: { dx: 120, dy: -40 } });
    });

    it('WHEN reading THEN the note keeps its exact text', () => {
      expect(readNote(text).text).toBe(text);
    });
  });

  describe('GIVEN an item with an aliased link and a plain link', () => {
    const text = noteText('- root ^r', '\t- [[note|alias]] and [[Other]] ^a');

    it('WHEN reading THEN the label shows the alias and the note name', () => {
      expect(readNote(text).nodes[1]?.label).toBe('alias and Other');
    });
  });

  describe('GIVEN a note indented with spaces', () => {
    const text = noteText('- root ^r', '  - a ^a', '    - a1 ^a1', '  - b ^b');

    it('WHEN reading THEN nesting follows the indentation', () => {
      expect(readNote(text).nodes.map((node) => node.parentId)).toEqual([null, 'r', 'a', 'r']);
    });
  });

  describe('GIVEN an item that skips an indentation level', () => {
    const text = noteText('- root ^r', '\t\t\t- deep ^d', '\t- shallow ^s');

    it('WHEN reading THEN both attach to the nearest shallower item', () => {
      expect(readNote(text).nodes.map((node) => node.parentId)).toEqual([null, 'r', 'r']);
    });
  });

  describe('GIVEN items without block ids', () => {
    const text = noteText('- root', '\t- child ^c', '\t- other');

    it('WHEN reading THEN the missing ids are generated', () => {
      expect(readNote(text).nodes.map((node) => node.id)).toEqual(['gen1', 'c', 'gen2']);
    });
  });

  describe('GIVEN a generated id that is already used in the note', () => {
    const text = noteText('- root ^gen1', '\t- child');

    it('WHEN reading THEN the next unused id is taken', () => {
      expect(readNote(text).nodes[1]?.id).toBe('gen2');
    });
  });

  describe('GIVEN two items with the same block id', () => {
    const text = noteText('- root ^r', '\t- a ^same', '\t- b ^same');

    it('WHEN reading THEN the problem names both lines and the id', () => {
      expect(readProblem(text)).toBe(NOTE_PROBLEM.duplicateBlockId('same', 2, 3));
    });
  });

  describe('GIVEN two top-level items', () => {
    const text = noteText('- first', '- second');

    it('WHEN reading THEN the problem asks for exactly one top-level item', () => {
      expect(readProblem(text)).toBe(NOTE_PROBLEM.severalTopLevelItems(2));
    });
  });

  describe('GIVEN a note without a list', () => {
    const text = noteText('---', 'organic-mindmap: 1', '---', 'Just a paragraph.');

    it('WHEN reading THEN the problem says a list item is needed', () => {
      expect(readProblem(text)).toBe(NOTE_PROBLEM.noListItem);
    });
  });

  describe('GIVEN list lines in the frontmatter, a code block and a comment', () => {
    const text = noteText(
      '---',
      'organic-mindmap: 1',
      'tags:',
      '  - mindmap',
      '---',
      '```',
      '- not an item',
      '```',
      '%% - hidden',
      '- also hidden %%',
      '- root ^r',
    );

    it('WHEN reading THEN only the real list item is a node', () => {
      expect(readNote(text).nodes.map((node) => node.id)).toEqual(['r']);
    });
  });

  describe('GIVEN an item with continuation lines', () => {
    const text = noteText('- root ^r', '\t- a ^a', '\t  more about a', '\t- b ^b');

    it('WHEN reading THEN the continuation is not a node', () => {
      expect(readNote(text).nodes.map((node) => node.id)).toEqual(['r', 'a', 'b']);
    });
  });

  describe('GIVEN a malformed layout block', () => {
    const text = noteText('- root ^r', '\t- a ^a', '%%', '```organic-mindmap-layout', '{"a": {"dx": 1', '```', '%%');

    it('WHEN reading THEN the map opens without saved offsets', () => {
      expect(readNote(text).positions).toEqual({});
    });
  });

  describe('GIVEN saved offsets for ids that are not in the list', () => {
    const text = noteText('- root ^r', '%%', '```organic-mindmap-layout', '{"gone": {"dx": 1, "dy": 2}}', '```', '%%');

    it('WHEN reading THEN those offsets are dropped', () => {
      expect(readNote(text).positions).toEqual({});
    });
  });
});
