import { appendBlockId, formatListItemLine, parseListItemLine, toSingleLine } from './listItemLine';

describe('parseListItemLine', () => {
  it('GIVEN a tab-indented item with a block id WHEN parsing THEN text and id are split', () => {
    expect(parseListItemLine('\t- [[Some note]] ^n7f3k')).toEqual({
      indent: '\t',
      marker: '-',
      prefix: '\t- ',
      text: '[[Some note]]',
      blockId: 'n7f3k',
    });
  });

  it('GIVEN an item without a block id WHEN parsing THEN the id is null', () => {
    expect(parseListItemLine('- plain idea')?.blockId).toBeNull();
  });

  it('GIVEN a caret inside the text WHEN parsing THEN it is not taken as a block id', () => {
    expect(parseListItemLine('- 2^10 is 1024')?.blockId).toBeNull();
  });

  it('GIVEN a task item WHEN parsing THEN the checkbox stays in the prefix, not the text', () => {
    expect(parseListItemLine('- [x] done ^a1')?.prefix).toBe('- [x] ');
  });

  it('GIVEN an ordered item WHEN parsing THEN the number is the marker', () => {
    expect(parseListItemLine('  1. first')?.marker).toBe('1.');
  });

  it('GIVEN a bare marker WHEN parsing THEN the prefix gets one space', () => {
    expect(parseListItemLine('-')?.prefix).toBe('- ');
  });

  it.each(['---', '* * *', '**bold**', 'plain text', '-no space'])('GIVEN [%s] WHEN parsing THEN it is not an item', (line) => {
    expect(parseListItemLine(line)).toBeNull();
  });
});

describe('formatListItemLine', () => {
  it('GIVEN empty text WHEN formatting THEN the id follows the marker', () => {
    expect(formatListItemLine('- ', '', 'abc')).toBe('- ^abc');
  });
});

describe('appendBlockId', () => {
  it('GIVEN a line with trailing spaces WHEN appending an id THEN it is separated by one space', () => {
    expect(appendBlockId('- idea  ', 'abc')).toBe('- idea ^abc');
  });
});

describe('toSingleLine', () => {
  it('GIVEN typed text with line breaks WHEN converting THEN they become single spaces', () => {
    expect(toSingleLine('first\n  second\r\nthird')).toBe('first second third');
  });
});
