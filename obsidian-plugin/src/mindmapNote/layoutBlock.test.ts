import { findLayoutBlock, formatLayoutJsonLines, parseLayoutJson } from './layoutBlock';

describe('findLayoutBlock', () => {
  it('GIVEN a closed layout block WHEN finding THEN the fence lines are returned', () => {
    expect(findLayoutBlock(['- a', '%%', '```organic-mindmap-layout', '{}', '```', '%%'], 0)).toEqual({
      openLine: 2,
      closeLine: 4,
    });
  });

  it('GIVEN a layout block without a closing fence WHEN finding THEN there is none', () => {
    expect(findLayoutBlock(['```organic-mindmap-layout', '{}'], 0)).toBeNull();
  });

  it('GIVEN a code block of another language WHEN finding THEN there is none', () => {
    expect(findLayoutBlock(['```json', '{}', '```'], 0)).toBeNull();
  });
});

describe('parseLayoutJson', () => {
  it('GIVEN valid offsets WHEN parsing THEN they are read by id', () => {
    expect(parseLayoutJson('{"n7f3k": {"dx": 120, "dy": -40}}')).toEqual(new Map([['n7f3k', { dx: 120, dy: -40 }]]));
  });

  it('GIVEN malformed JSON WHEN parsing THEN there are no offsets', () => {
    expect(parseLayoutJson('{"n7f3k": {"dx": 120,')).toEqual(new Map());
  });

  it('GIVEN a JSON array WHEN parsing THEN there are no offsets', () => {
    expect(parseLayoutJson('[1, 2]')).toEqual(new Map());
  });

  it('GIVEN one entry without numbers WHEN parsing THEN only that entry is skipped', () => {
    expect(parseLayoutJson('{"a": {"dx": "1", "dy": 2}, "b": {"dx": 1, "dy": 2}}')).toEqual(
      new Map([['b', { dx: 1, dy: 2 }]]),
    );
  });
});

describe('formatLayoutJsonLines', () => {
  it('GIVEN unsorted fractional offsets WHEN formatting THEN ids are sorted, one per line, rounded', () => {
    const offsets = new Map([
      ['b', { dx: 1.6, dy: -0.2 }],
      ['a', { dx: 10, dy: 20 }],
    ]);
    expect(formatLayoutJsonLines(offsets)).toEqual(['{', '  "a": {"dx": 10, "dy": 20},', '  "b": {"dx": 2, "dy": 0}', '}']);
  });

  it('GIVEN no offsets WHEN formatting THEN it is an empty object', () => {
    expect(formatLayoutJsonLines(new Map())).toEqual(['{}']);
  });
});
