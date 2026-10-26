import { MarkdownChoices, MARKDOWN_VIEW_TYPE, MINDMAP_VIEW_TYPE, resolveViewType } from './viewSwitch';

describe('resolveViewType', () => {
  describe('GIVEN a mindmap note asked to open as Markdown', () => {
    const request = { requestedType: MARKDOWN_VIEW_TYPE, isMindmapNote: true };

    it('WHEN the user made no choice THEN it opens as a map', () => {
      expect(resolveViewType({ ...request, markdownChosen: false })).toBe(MINDMAP_VIEW_TYPE);
    });

    it('WHEN the user chose Markdown for it THEN it stays Markdown', () => {
      expect(resolveViewType({ ...request, markdownChosen: true })).toBe(MARKDOWN_VIEW_TYPE);
    });
  });

  it('GIVEN a plain note asked to open as Markdown THEN it stays Markdown', () => {
    expect(resolveViewType({ requestedType: MARKDOWN_VIEW_TYPE, isMindmapNote: false, markdownChosen: false })).toBe(
      MARKDOWN_VIEW_TYPE,
    );
  });

  it('GIVEN a request for another view type (e.g. the map itself) THEN it is left alone', () => {
    expect(resolveViewType({ requestedType: 'canvas', isMindmapNote: true, markdownChosen: false })).toBe('canvas');
  });
});

describe('MarkdownChoices', () => {
  describe('GIVEN Markdown chosen for one note in one leaf', () => {
    const leaf = {};
    const otherLeaf = {};
    const choices = new MarkdownChoices<object>();
    choices.chooseMarkdown(leaf, 'Map.md');

    it('THEN it is chosen for that note in that leaf only', () => {
      expect([
        choices.isMarkdownChosen(leaf, 'Map.md'),
        choices.isMarkdownChosen(leaf, 'Other.md'),
        choices.isMarkdownChosen(otherLeaf, 'Map.md'),
      ]).toEqual([true, false, false]);
    });

    it('WHEN the leaf forgets THEN it is no longer chosen', () => {
      const forgetting = new MarkdownChoices<object>();
      forgetting.chooseMarkdown(leaf, 'Map.md');
      forgetting.forget(leaf);
      expect(forgetting.isMarkdownChosen(leaf, 'Map.md')).toBe(false);
    });
  });
});
