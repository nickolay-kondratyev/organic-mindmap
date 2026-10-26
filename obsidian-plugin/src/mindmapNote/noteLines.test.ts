import { indentWidth, NoteLines, reindent } from './noteLines';

describe('NoteLines', () => {
  describe('GIVEN text with CRLF line breaks and no final line break', () => {
    const text = 'a\r\nb\r\nc';

    it('WHEN joined back without changes THEN it is byte-identical', () => {
      expect(NoteLines.fromText(text).toText()).toBe(text);
    });

    it('WHEN inserting after the last line THEN the new line uses CRLF and the file still has no final line break', () => {
      const lines = NoteLines.fromText(text);
      lines.insertAfter(2, ['d']);
      expect(lines.toText()).toBe('a\r\nb\r\nc\r\nd');
    });

    it('WHEN removing the last line THEN the file still has no final line break', () => {
      const lines = NoteLines.fromText(text);
      lines.remove(2, 2);
      expect(lines.toText()).toBe('a\r\nb');
    });
  });

  describe('GIVEN text ending with a line break', () => {
    const text = 'a\nb\n';

    it('WHEN inserting after the last line with content THEN the final line break is kept', () => {
      const lines = NoteLines.fromText(text);
      lines.insertAfter(1, ['c']);
      expect(lines.toText()).toBe('a\nb\nc\n');
    });

    it('WHEN removing a middle line THEN the other lines are unchanged', () => {
      const lines = NoteLines.fromText('a\nb\nc\n');
      expect(lines.remove(1, 1)).toEqual(['b']);
    });
  });

  describe('GIVEN an item with nested lines, a blank line inside and trailing blank lines', () => {
    const lines = NoteLines.fromText(['- a', '\t- b', '', '\t  more', '', '- c'].join('\n'));

    it('WHEN finding its subtree end THEN it is the last nested line, not the trailing blank', () => {
      expect(lines.subtreeEnd(0)).toBe(3);
    });
  });
});

describe('indentWidth', () => {
  it('GIVEN two spaces and a tab WHEN measuring THEN the tab advances to the next tab stop', () => {
    expect(indentWidth('  \t')).toBe(4);
  });
});

describe('reindent', () => {
  it('GIVEN a line nested deeper than the moved item WHEN re-indenting THEN its extra indentation is kept', () => {
    expect(reindent('\t\t- child', 4, '')).toBe('\t- child');
  });

  it('GIVEN a space-indented line WHEN re-indenting to a tab THEN the old indentation is replaced', () => {
    expect(reindent('    - child', 4, '\t\t')).toBe('\t\t- child');
  });

  it('GIVEN a lazy continuation line indented less than the item WHEN re-indenting THEN it is unchanged', () => {
    expect(reindent('lazy text', 4, '\t\t')).toBe('lazy text');
  });
});
