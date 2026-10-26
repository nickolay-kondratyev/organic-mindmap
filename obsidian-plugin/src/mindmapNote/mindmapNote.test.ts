import { EDIT_PROBLEM, type EditRequest, type NodeOffset } from 'organic-mindmap';
import type { MindmapNote } from './mindmapNote';
import { noteText, readNote } from './testSupport';

/** The written text; fails the test plainly when the write was refused. */
function written(note: MindmapNote, request: EditRequest): string {
  const result = note.applyEdit(request);
  if (result.kind !== 'written') throw new Error(`Expected a write, got refusal=[${result.reason}]`);
  return result.text;
}

function refusal(note: MindmapNote, request: EditRequest): string | null {
  const result = note.applyEdit(request);
  return result.kind === 'refused' ? result.reason : null;
}

function positionWritten(note: MindmapNote, nodeId: string, offset: NodeOffset): string {
  const result = note.setPosition(nodeId, offset);
  if (result.kind !== 'written') throw new Error(`Expected a write, got refusal=[${result.reason}]`);
  return result.text;
}

const FRONTMATTER = ['---', 'title: Phoenix', 'organic-mindmap: 1', 'aliases: [p]', '---'];

describe('MindmapNote edits', () => {
  describe('GIVEN a tab-indented note with text around the list and a nested branch', () => {
    const text = noteText(
      ...FRONTMATTER,
      'Intro paragraph.',
      '',
      '- Project Phoenix ^root',
      '\t- [[Some note|Notes]] ^a',
      '\t\t- a1 ^a1',
      '\t\t  continuation of a1',
      '\t- b ^b',
      '',
      'Closing paragraph.',
    );
    // Adds read their own note: generated ids come from a per-read counter.
    const note = readNote(text);

    it('WHEN renaming THEN only the item line changes, keeping its id', () => {
      expect(written(note, { type: 'rename', nodeId: 'b', text: 'better b' })).toBe(
        text.replace('\t- b ^b', '\t- better b ^b'),
      );
    });

    it('WHEN renaming a linked item THEN the typed text replaces the link', () => {
      expect(written(note, { type: 'rename', nodeId: 'a', text: 'Notes' })).toBe(
        text.replace('\t- [[Some note|Notes]] ^a', '\t- Notes ^a'),
      );
    });

    it('WHEN renaming with typed line breaks THEN the item stays one line', () => {
      expect(written(note, { type: 'rename', nodeId: 'b', text: 'two\nlines' })).toBe(
        text.replace('\t- b ^b', '\t- two lines ^b'),
      );
    });

    it('WHEN renaming to the same text THEN the note is byte-identical', () => {
      expect(written(note, { type: 'rename', nodeId: 'b', text: 'b' })).toBe(text);
    });

    it('WHEN adding under an item with a nested branch THEN the item becomes its last child, tab-indented', () => {
      expect(written(readNote(text), { type: 'add', parentId: 'a', text: 'a2' })).toBe(
        text.replace('\t\t  continuation of a1\n', '\t\t  continuation of a1\n\t\t- a2 ^gen1\n'),
      );
    });

    it('WHEN adding a first-level node with a side THEN the side is ignored and it is the root\'s last child', () => {
      expect(written(readNote(text), { type: 'add', parentId: 'root', text: 'c', side: 'left' })).toBe(
        text.replace('\t- b ^b\n', '\t- b ^b\n\t- c ^gen1\n'),
      );
    });

    it('WHEN moving a branch deeper THEN it moves with its continuation lines, re-indented, as last child', () => {
      expect(written(note, { type: 'move', nodeId: 'a', newParentId: 'b' })).toBe(
        noteText(
          ...FRONTMATTER,
          'Intro paragraph.',
          '',
          '- Project Phoenix ^root',
          '\t- b ^b',
          '\t\t- [[Some note|Notes]] ^a',
          '\t\t\t- a1 ^a1',
          '\t\t\t  continuation of a1',
          '',
          'Closing paragraph.',
        ),
      );
    });

    it('WHEN moving an item up to the root THEN it is re-indented one level shallower', () => {
      expect(written(note, { type: 'move', nodeId: 'a1', newParentId: 'root' })).toBe(
        noteText(
          ...FRONTMATTER,
          'Intro paragraph.',
          '',
          '- Project Phoenix ^root',
          '\t- [[Some note|Notes]] ^a',
          '\t- b ^b',
          '\t- a1 ^a1',
          '\t  continuation of a1',
          '',
          'Closing paragraph.',
        ),
      );
    });

    it('WHEN deleting a branch THEN its lines and continuation lines are removed', () => {
      expect(written(note, { type: 'delete', nodeId: 'a' })).toBe(
        text.replace('\t- [[Some note|Notes]] ^a\n\t\t- a1 ^a1\n\t\t  continuation of a1\n', ''),
      );
    });

    it('WHEN moving an item into its own branch THEN it is refused', () => {
      expect(refusal(note, { type: 'move', nodeId: 'a', newParentId: 'a1' })).toBe(EDIT_PROBLEM.moveIntoOwnBranch);
    });

    it('WHEN moving the root THEN it is refused', () => {
      expect(refusal(note, { type: 'move', nodeId: 'root', newParentId: 'b' })).toBe(EDIT_PROBLEM.moveIntoOwnBranch);
    });

    it('WHEN deleting the root THEN it is refused', () => {
      expect(refusal(note, { type: 'delete', nodeId: 'root' })).toBe(EDIT_PROBLEM.deleteRoot);
    });

    it('WHEN editing a node that is not in the note THEN it is refused', () => {
      expect(refusal(note, { type: 'rename', nodeId: 'gone', text: 'x' })).toBe(EDIT_PROBLEM.unknownNode);
    });
  });

  describe('GIVEN a note indented with two spaces', () => {
    const text = noteText('- root ^r', '  - a ^a', '  - b ^b');
    const note = readNote(text);

    it('WHEN adding THEN the new item uses the note\'s two-space indentation', () => {
      expect(written(note, { type: 'add', parentId: 'a', text: 'a1' })).toBe(
        noteText('- root ^r', '  - a ^a', '    - a1 ^gen1', '  - b ^b'),
      );
    });

    it('WHEN moving THEN the item uses the note\'s two-space indentation', () => {
      expect(written(note, { type: 'move', nodeId: 'b', newParentId: 'a' })).toBe(
        noteText('- root ^r', '  - a ^a', '    - b ^b'),
      );
    });
  });

  describe('GIVEN a note with only a root, using "*" bullets', () => {
    const note = readNote(noteText('* root ^r'));

    it('WHEN adding THEN the child is tab-indented with the note\'s bullet', () => {
      expect(written(note, { type: 'add', parentId: 'r', text: 'child' })).toBe(noteText('* root ^r', '\t* child ^gen1'));
    });
  });

  describe('GIVEN a note whose last item ends the file without a line break', () => {
    const text = '- root ^r\n\t- a ^a\n\t- b ^b';
    const note = readNote(text);

    it('WHEN adding at the end THEN the file still has no final line break', () => {
      expect(written(note, { type: 'add', parentId: 'r', text: 'c' })).toBe(`${text}\n\t- c ^gen1`);
    });

    it('WHEN moving the last item THEN the file still has no final line break', () => {
      expect(written(note, { type: 'move', nodeId: 'b', newParentId: 'a' })).toBe('- root ^r\n\t- a ^a\n\t\t- b ^b');
    });

    it('WHEN deleting the last item THEN the file still has no final line break', () => {
      expect(written(note, { type: 'delete', nodeId: 'b' })).toBe('- root ^r\n\t- a ^a');
    });
  });

  describe('GIVEN a note with CRLF line breaks', () => {
    const note = readNote('- root ^r\r\n\t- a ^a\r\n');

    it('WHEN adding THEN the new line uses CRLF too', () => {
      expect(written(note, { type: 'add', parentId: 'r', text: 'b' })).toBe('- root ^r\r\n\t- a ^a\r\n\t- b ^gen1\r\n');
    });

    it('WHEN saving a position THEN the new layout block uses CRLF too', () => {
      expect(positionWritten(readNote('- root ^r\r\n\t- a ^a\r\n'), 'a', { dx: 1, dy: 2 })).toBe(
        '- root ^r\r\n\t- a ^a\r\n\r\n%%\r\n```organic-mindmap-layout\r\n{\r\n  "a": {"dx": 1, "dy": 2}\r\n}\r\n```\r\n%%\r\n',
      );
    });
  });

  describe('GIVEN a parent whose last child has its own nested branch', () => {
    const text = noteText('- root ^r', '\t- a ^a', '\t\t- a1 ^a1', '\t\t\t- a11 ^a11', '\t- b ^b');

    it('WHEN adding under the parent THEN the new item comes after the whole nested branch', () => {
      expect(written(readNote(text), { type: 'add', parentId: 'a', text: 'a2' })).toBe(
        noteText('- root ^r', '\t- a ^a', '\t\t- a1 ^a1', '\t\t\t- a11 ^a11', '\t\t- a2 ^gen1', '\t- b ^b'),
      );
    });
  });

  describe('GIVEN a task item', () => {
    const note = readNote(noteText('- root ^r', '\t- [ ] task ^t'));

    it('WHEN renaming THEN the checkbox is kept', () => {
      expect(written(note, { type: 'rename', nodeId: 't', text: 'renamed' })).toBe(noteText('- root ^r', '\t- [ ] renamed ^t'));
    });
  });

  describe('GIVEN items without block ids', () => {
    const text = noteText('- root', '\t- a', '\t- b ^b');
    const note = readNote(text);

    it('WHEN reading THEN the text is unchanged (opening never rewrites)', () => {
      expect(note.text).toBe(text);
    });

    it('WHEN the first edit is written THEN every item gets its generated id', () => {
      expect(written(note, { type: 'rename', nodeId: 'b', text: 'b2' })).toBe(
        noteText('- root ^gen1', '\t- a ^gen2', '\t- b2 ^b'),
      );
    });

    it('WHEN adding THEN the new item gets an id different from the generated ones', () => {
      expect(written(readNote(text), { type: 'add', parentId: 'gen2', text: 'new' })).toBe(
        noteText('- root ^gen1', '\t- a ^gen2', '\t\t- new ^gen3', '\t- b ^b'),
      );
    });
  });
});

describe('MindmapNote.setPosition', () => {
  describe('GIVEN a note without a layout block and text after the list', () => {
    const text = noteText('- root ^r', '\t- a ^a', 'After the list.');
    const note = readNote(text);

    it('WHEN saving a position THEN a hidden layout block is added right after the list', () => {
      expect(positionWritten(note, 'a', { dx: 120, dy: -40 })).toBe(
        noteText(
          '- root ^r',
          '\t- a ^a',
          '',
          '%%',
          '```organic-mindmap-layout',
          '{',
          '  "a": {"dx": 120, "dy": -40}',
          '}',
          '```',
          '%%',
          '',
          'After the list.',
        ),
      );
    });

    it('WHEN the written note is read again THEN the position is there', () => {
      expect(readNote(positionWritten(note, 'a', { dx: 120, dy: -40 })).positions).toEqual({ a: { dx: 120, dy: -40 } });
    });
  });

  describe('GIVEN a note with a layout block holding an unknown id', () => {
    const text = noteText(
      '- root ^r',
      '\t- a ^a',
      '\t- b ^b',
      '',
      '%%',
      '```organic-mindmap-layout',
      '{"gone": {"dx": 5, "dy": 5}, "b": {"dx": 1, "dy": 2}}',
      '```',
      '%%',
      'Footer.',
    );
    const note = readNote(text);

    it('WHEN saving a position THEN the block is rewritten sorted and without the unknown id', () => {
      expect(positionWritten(note, 'a', { dx: 3, dy: 4 })).toBe(
        text.replace(
          '{"gone": {"dx": 5, "dy": 5}, "b": {"dx": 1, "dy": 2}}',
          '{\n  "a": {"dx": 3, "dy": 4},\n  "b": {"dx": 1, "dy": 2}\n}',
        ),
      );
    });

    it('WHEN saving the same positions twice THEN the second write changes nothing', () => {
      const first = positionWritten(note, 'a', { dx: 3, dy: 4 });
      expect(positionWritten(readNote(first), 'a', { dx: 3, dy: 4 })).toBe(first);
    });

    it('WHEN saving a position for a node not in the note THEN it is refused', () => {
      expect(note.setPosition('gone', { dx: 0, dy: 0 })).toEqual({ kind: 'refused', reason: EDIT_PROBLEM.unknownNode });
    });
  });

  describe('GIVEN a note with a malformed layout block', () => {
    const text = noteText('- root ^r', '%%', '```organic-mindmap-layout', '{oops', '```', '%%');
    const note = readNote(text);

    it('WHEN saving a position THEN the broken JSON is replaced', () => {
      expect(positionWritten(note, 'r', { dx: 0, dy: 0 })).toBe(text.replace('{oops', '{\n  "r": {"dx": 0, "dy": 0}\n}'));
    });
  });

  describe('GIVEN an item without a block id', () => {
    const note = readNote(noteText('- root ^r', '\t- a'));

    it('WHEN saving its position THEN its generated id is written to the item and the layout', () => {
      expect(positionWritten(note, 'gen1', { dx: 1, dy: 1 })).toBe(
        noteText('- root ^r', '\t- a ^gen1', '', '%%', '```organic-mindmap-layout', '{', '  "gen1": {"dx": 1, "dy": 1}', '}', '```', '%%'),
      );
    });
  });
});
