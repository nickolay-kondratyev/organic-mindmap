/** The part of a focused DOM element the undo keys look at; a structural type so the rule is unit-tested without a DOM. */
export interface FocusedElementShape {
  readonly tagName: string;
  readonly isContentEditable: boolean;
  /** `Element.closest`: the nearest ancestor-or-self matching `selector`, else `null`. */
  closest(selector: string): unknown;
}

const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA']);
const DIALOG_SELECTOR = '[role="dialog"]';

/**
 * Whether Ctrl+Z belongs to what has focus rather than to the map: a text field (the inline rename editor) has its
 * own native undo, and a dialog (the reparent question) must not have the map change under it.
 */
export function keyBelongsToTextEntry(focused: FocusedElementShape | null): boolean {
  if (focused === null) return false;
  return TEXT_ENTRY_TAGS.has(focused.tagName.toUpperCase()) || focused.isContentEditable || focused.closest(DIALOG_SELECTOR) !== null;
}
