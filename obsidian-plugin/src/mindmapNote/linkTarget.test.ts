import { firstLinkTarget } from './linkTarget';

describe('firstLinkTarget', () => {
  it('GIVEN a plain link THEN it is the link target', () => {
    expect(firstLinkTarget('See [[Some note]] later')).toBe('Some note');
  });

  it('GIVEN an aliased link THEN the alias is dropped', () => {
    expect(firstLinkTarget('[[Some note|shown text]]')).toBe('Some note');
  });

  it('GIVEN a heading link THEN the subpath is kept so Obsidian can jump to it', () => {
    expect(firstLinkTarget('[[Some note#Section]]')).toBe('Some note#Section');
  });

  it('GIVEN an embed THEN its target counts as the link', () => {
    expect(firstLinkTarget('![[Image.png]]')).toBe('Image.png');
  });

  it('GIVEN several links THEN the first one wins', () => {
    expect(firstLinkTarget('[[First]] and [[Second]]')).toBe('First');
  });

  it('GIVEN text without a link THEN it is null', () => {
    expect(firstLinkTarget('plain idea')).toBeNull();
  });

  it('GIVEN an empty link THEN it is null', () => {
    expect(firstLinkTarget('[[]]')).toBeNull();
  });
});
