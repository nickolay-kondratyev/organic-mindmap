import { createCanvasOverlayElement, placeOverCanvas } from './canvasOverlayElement';
import type { ReparentAnswer } from './reparentConfirmation';

/** Visible labels; also the accessible names E2E tests find the controls by. */
export const REPARENT_DIALOG_LABELS = {
  confirm: 'Make child',
  cancel: 'Cancel',
  dontAskAgain: "Don't ask again",
} as const;

/** Class names styled by the library stylesheet. */
const DIALOG_CLASSES = {
  dialog: 'organic-mindmap-reparent-dialog',
  question: 'organic-mindmap-reparent-question',
  option: 'organic-mindmap-reparent-option',
  buttons: 'organic-mindmap-reparent-buttons',
} as const;

/** Makes `aria-labelledby` ids unique when a page mounts several maps. */
let dialogCount = 0;

export interface ReparentDialogSession {
  /** The question, e.g. `Make "Hamlet" a child of "POESIA"?`; also the dialog's accessible name. */
  readonly text: string;
  readonly onConfirm: (answer: ReparentAnswer) => void;
  readonly onCancel: () => void;
}

/**
 * Yes/no dialog over the centre of the canvas for a drop onto a node (spec I3), with "Don't ask again".
 * Focus moves to the confirm button; Enter confirms (on the Cancel button it cancels, as buttons do), Escape cancels.
 * Created on first use, like the other canvas overlays. Ceiling: not modal (no focus trap, page stays usable), the
 * canvas itself ignores presses while it is open.
 */
export class ReparentDialog {
  private parts: DialogParts | null = null;
  private session: ReparentDialogSession | null = null;
  /** Where focus was before opening, so keyboard users land back there. */
  private returnFocusTo: HTMLElement | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  open(session: ReparentDialogSession): void {
    const parts = this.parts ?? this.create();
    this.session = session;
    const active = this.canvas.ownerDocument.activeElement;
    this.returnFocusTo = active instanceof HTMLElement ? active : null;
    parts.text.textContent = session.text;
    parts.dontAskAgain.checked = false;
    parts.element.hidden = false;
    this.place();
    parts.confirm.focus();
  }

  /** Keeps it centred over the canvas when the canvas moves or resizes. */
  place(): void {
    if (this.parts === null || this.session === null) return;
    placeOverCanvas(this.parts.element, this.canvas, { x: this.canvas.clientWidth / 2, y: this.canvas.clientHeight / 2 });
  }

  /** Hides and gives focus back; answering is up to the caller (`finish`). */
  private close(): void {
    this.session = null;
    if (this.parts !== null) this.parts.element.hidden = true;
    const returnFocusTo = this.returnFocusTo;
    this.returnFocusTo = null;
    if (returnFocusTo?.isConnected === true) returnFocusTo.focus();
  }

  dispose(): void {
    this.session = null;
    this.parts?.element.remove();
    this.parts = null;
  }

  /** Closes first, so the answer runs with the dialog already gone (and cannot answer twice). */
  private finish(answer: (session: ReparentDialogSession) => void): void {
    const session = this.session;
    if (session === null) return;
    this.close();
    answer(session);
  }

  private confirm(): void {
    const dontAskAgain = this.parts?.dontAskAgain.checked ?? false;
    this.finish((session) => session.onConfirm({ dontAskAgain }));
  }

  private create(): DialogParts {
    const element = createCanvasOverlayElement(this.canvas, 'div', DIALOG_CLASSES.dialog);
    const doc = element.ownerDocument;
    dialogCount += 1;
    const textId = `organic-mindmap-reparent-question-${dialogCount}`;
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-labelledby', textId);
    element.hidden = true;

    const text = doc.createElement('p');
    text.id = textId;
    text.classList.add(DIALOG_CLASSES.question);

    const dontAskAgain = doc.createElement('input');
    dontAskAgain.type = 'checkbox';
    const checkboxLabel = doc.createElement('label');
    checkboxLabel.classList.add(DIALOG_CLASSES.option);
    checkboxLabel.append(dontAskAgain, REPARENT_DIALOG_LABELS.dontAskAgain);

    const cancel = button(doc, REPARENT_DIALOG_LABELS.cancel);
    const confirm = button(doc, REPARENT_DIALOG_LABELS.confirm);
    cancel.addEventListener('click', () => this.finish((session) => session.onCancel()));
    confirm.addEventListener('click', () => this.confirm());
    const buttons = doc.createElement('div');
    buttons.classList.add(DIALOG_CLASSES.buttons);
    buttons.append(cancel, confirm);

    element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.finish((session) => session.onCancel());
      } else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
        // Buttons act on Enter themselves (Cancel cancels); anywhere else in the dialog Enter confirms.
        event.preventDefault();
        this.confirm();
      }
    });

    element.append(text, checkboxLabel, buttons);
    this.parts = { element, text, dontAskAgain, confirm };
    return this.parts;
  }
}

interface DialogParts {
  readonly element: HTMLDivElement;
  readonly text: HTMLParagraphElement;
  readonly dontAskAgain: HTMLInputElement;
  readonly confirm: HTMLButtonElement;
}

function button(doc: Document, label: string): HTMLButtonElement {
  const element = doc.createElement('button');
  element.type = 'button';
  element.textContent = label;
  return element;
}
