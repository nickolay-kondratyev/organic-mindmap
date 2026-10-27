import { keyBelongsToTextEntry, type FocusedElementShape } from './textEntryFocus';

function element(tagName: string, options: { editable?: boolean; inDialog?: boolean } = {}): FocusedElementShape {
  return {
    tagName,
    isContentEditable: options.editable ?? false,
    closest: (selector) => (selector === '[role="dialog"]' && options.inDialog === true ? {} : null),
  };
}

describe('keyBelongsToTextEntry', () => {
  it('WHEN nothing has focus THEN the key goes to the map', () => {
    expect(keyBelongsToTextEntry(null)).toBe(false);
  });

  it('WHEN the map canvas has focus THEN the key goes to the map', () => {
    expect(keyBelongsToTextEntry(element('CANVAS'))).toBe(false);
  });

  it('WHEN a text input has focus (the inline rename editor) THEN the key belongs to the input', () => {
    expect(keyBelongsToTextEntry(element('INPUT'))).toBe(true);
  });

  it('WHEN a textarea has focus THEN the key belongs to the textarea', () => {
    expect(keyBelongsToTextEntry(element('textarea'))).toBe(true);
  });

  it('WHEN a contenteditable element has focus THEN the key belongs to it', () => {
    expect(keyBelongsToTextEntry(element('DIV', { editable: true }))).toBe(true);
  });

  it('WHEN a button inside a dialog has focus (the reparent question) THEN the key belongs to the dialog', () => {
    expect(keyBelongsToTextEntry(element('BUTTON', { inDialog: true }))).toBe(true);
  });
});
