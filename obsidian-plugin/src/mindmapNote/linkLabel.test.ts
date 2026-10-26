import { displayLabel } from './linkLabel';

describe('displayLabel', () => {
  it('GIVEN a link WHEN labeling THEN it shows the note name', () => {
    expect(displayLabel('see [[Some note]]')).toBe('see Some note');
  });

  it('GIVEN a link with an alias WHEN labeling THEN it shows the alias', () => {
    expect(displayLabel('[[note|Nice name]]')).toBe('Nice name');
  });

  it('GIVEN a link to a heading WHEN labeling THEN it shows note and heading like Obsidian', () => {
    expect(displayLabel('[[Note#Heading]]')).toBe('Note > Heading');
  });

  it('GIVEN an embed WHEN labeling THEN it shows the name without the "!"', () => {
    expect(displayLabel('![[diagram.png]]')).toBe('diagram.png');
  });

  it('GIVEN plain text WHEN labeling THEN it is unchanged', () => {
    expect(displayLabel('plain [idea]')).toBe('plain [idea]');
  });
});
