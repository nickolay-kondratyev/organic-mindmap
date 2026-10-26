import type { MindmapData } from 'organic-mindmap';
import { HEADING_MAP_ROOT_ID, PASTED_NOTE_TITLE, headingMapData, parseHeadings } from './headingMap';

/** `text -> parent's text` per non-root node, so expectations read like the outline they describe. */
function parentsByText(data: MindmapData): Record<string, string | undefined> {
  const textOf = new Map(data.map((node) => [node.id, node.text]));
  return Object.fromEntries(data.filter((node) => node.parentId !== null).map((node) => [node.text, textOf.get(node.parentId ?? '')]));
}

function rootText(data: MindmapData): string | undefined {
  return data.find((node) => node.parentId === null)?.text;
}

describe('GIVEN Markdown with nested headings and no H1', () => {
  const markdown = ['## Plan', '### Goals', '### Risks', '## Notes'].join('\n');

  it('WHEN mapped THEN each heading hangs under the nearest heading above it with a lower level', () => {
    expect(parentsByText(headingMapData(markdown))).toEqual({ Plan: PASTED_NOTE_TITLE, Goals: 'Plan', Risks: 'Plan', Notes: PASTED_NOTE_TITLE });
  });

  it('WHEN mapped THEN the root is the fixed note title', () => {
    expect(rootText(headingMapData(markdown))).toBe(PASTED_NOTE_TITLE);
  });

  it('WHEN mapped THEN headings keep document order', () => {
    expect(headingMapData(markdown).map((node) => node.text)).toEqual([PASTED_NOTE_TITLE, 'Plan', 'Goals', 'Risks', 'Notes']);
  });
});

describe('GIVEN Markdown that skips a level', () => {
  const markdown = ['## Plan', '#### Detail'].join('\n');

  it('WHEN mapped THEN the deeper heading attaches to the heading above it', () => {
    expect(parentsByText(headingMapData(markdown)).Detail).toBe('Plan');
  });
});

describe('GIVEN Markdown with exactly one H1', () => {
  const markdown = ['# Trip to Rome', '## Flights', '### Return', '## Hotels'].join('\n');

  it('WHEN mapped THEN the H1 is the root', () => {
    expect(rootText(headingMapData(markdown))).toBe('Trip to Rome');
  });

  it('WHEN mapped THEN its sub-headings hang under the root', () => {
    expect(parentsByText(headingMapData(markdown))).toEqual({ Flights: 'Trip to Rome', Return: 'Flights', Hotels: 'Trip to Rome' });
  });
});

describe('GIVEN Markdown with two H1s', () => {
  const markdown = ['# Part one', '# Part two'].join('\n');

  it('WHEN mapped THEN both H1s hang under the fixed note title', () => {
    expect(parentsByText(headingMapData(markdown))).toEqual({ 'Part one': PASTED_NOTE_TITLE, 'Part two': PASTED_NOTE_TITLE });
  });
});

describe('GIVEN Markdown with text before the first heading', () => {
  const markdown = ['Some intro text.', '- a list item', '', '## First'].join('\n');

  it('WHEN mapped THEN only the heading becomes a node under the root', () => {
    expect(headingMapData(markdown).map((node) => node.text)).toEqual([PASTED_NOTE_TITLE, 'First']);
  });
});

describe('GIVEN Markdown with "#" lines inside fenced code blocks', () => {
  const markdown = ['## Setup', '```bash', '# install deps', '```', '~~~~', '# still code', '~~~', '## not yet closed', '~~~~', '## Usage'].join('\n');

  it('WHEN parsed THEN the lines inside the fences are not headings', () => {
    expect(parseHeadings(markdown).map((heading) => heading.text)).toEqual(['Setup', 'Usage']);
  });
});

describe('GIVEN Markdown with YAML frontmatter containing a "# comment"', () => {
  const markdown = ['---', '# a yaml comment', 'tags: [trip]', '---', '## Flights'].join('\n');

  it('WHEN parsed THEN the comment is not a heading', () => {
    expect(parseHeadings(markdown).map((heading) => heading.text)).toEqual(['Flights']);
  });
});

describe('GIVEN lines that only look like headings', () => {
  const markdown = ['#tag', '    # indented code', '####### seven'].join('\n');

  it('WHEN parsed THEN none of them is a heading', () => {
    expect(parseHeadings(markdown)).toEqual([]);
  });
});

describe('GIVEN a heading with a closing "#" run', () => {
  it('WHEN parsed THEN the closing run is dropped from its text', () => {
    expect(parseHeadings('## C# tips ##')).toEqual([{ level: 2, text: 'C# tips' }]);
  });
});

describe('GIVEN Markdown without headings', () => {
  it('WHEN mapped THEN the map is just the root', () => {
    expect(headingMapData('Just text.')).toEqual([{ id: HEADING_MAP_ROOT_ID, parentId: null, text: PASTED_NOTE_TITLE }]);
  });
});
