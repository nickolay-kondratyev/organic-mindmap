import type { Point } from '../model/node';
import { createCanvasOverlayElement, placeOverCanvas } from './canvasOverlayElement';

/** Where and how the editor is drawn, in canvas CSS px; recomputed every paint so it follows pan/zoom. */
export interface LabelEditorPlacement {
  readonly center: Point;
  readonly width: number;
  readonly fontSizePx: number;
  readonly fontFamily: string;
  readonly bold: boolean;
  readonly letterSpacingEm: number;
  readonly color: string;
  /** The node's fill, so the input covers the canvas label it replaces. */
  readonly background: string;
}

export interface LabelEditSession {
  readonly text: string;
  /** Enter or focus loss. */
  readonly onCommit: (text: string) => void;
  /** Escape. */
  readonly onCancel: () => void;
}

/** Input height as a multiple of the font size: room for ascenders and descenders of a handwritten font. */
const LINE_HEIGHT_FACTOR = 1.5;
/** Accessible name; also what E2E tests find the input by. */
export const LABEL_EDITOR_ACCESSIBLE_NAME = 'Node label';
const EDITOR_CLASS = 'organic-mindmap-label-editor';
/** Set while the edited node is not in the scene; see the library stylesheet. */
const OFF_SCENE_CLASS = 'is-off-scene';

/**
 * Inline label input (spec I4) floating over a node. A real `<input>` gives caret, selection, IME and
 * clipboard for free; it uses the label font itself (see `CssFontFaces`). Created on first use, so maps that
 * are never edited add no DOM.
 */
export class InlineLabelEditor {
  private input: HTMLInputElement | null = null;
  private session: LabelEditSession | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  open(session: LabelEditSession): void {
    this.close();
    const input = this.input ?? this.createInput();
    this.session = session;
    input.value = session.text;
    input.hidden = false;
    input.focus();
    input.select();
  }

  /** `null` hides the input (e.g. its node is not in the scene this frame) without ending the session. */
  place(placement: LabelEditorPlacement | null): void {
    const input = this.input;
    if (input === null || this.session === null) return;
    input.classList.toggle(OFF_SCENE_CLASS, placement === null);
    if (placement === null) return;
    const height = placement.fontSizePx * LINE_HEIGHT_FACTOR;
    placeOverCanvas(input, this.canvas, { x: placement.center.x - placement.width / 2, y: placement.center.y - height / 2 });
    input.style.width = `${placement.width}px`;
    input.style.height = `${height}px`;
    input.style.font = `${placement.bold ? 'bold ' : ''}${placement.fontSizePx}px ${placement.fontFamily}`;
    input.style.letterSpacing = `${placement.letterSpacingEm}em`;
    input.style.color = placement.color;
    input.style.background = placement.background;
    input.style.borderRadius = `${height / 2}px`;
  }

  /** Ends the session without committing or cancelling, and lets go of the focus. */
  close(): void {
    this.session = null;
    if (this.input === null) return;
    // Chromium blurs a hidden input only at the next frame; until then keys (e.g. a host's Ctrl+Z) would be the
    // input's. Blurring with the session already null means the blur listener commits nothing.
    this.input.blur();
    this.input.hidden = true;
  }

  dispose(): void {
    this.close();
    this.input?.remove();
    this.input = null;
  }

  private createInput(): HTMLInputElement {
    const input = createCanvasOverlayElement(this.canvas, 'input', EDITOR_CLASS);
    input.type = 'text';
    input.setAttribute('aria-label', LABEL_EDITOR_ACCESSIBLE_NAME);
    input.spellcheck = false;
    input.hidden = true;
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.finish((session, text) => session.onCommit(text));
      else if (event.key === 'Escape') this.finish((session) => session.onCancel());
    });
    // Clicking elsewhere commits, like most inline editors.
    input.addEventListener('blur', () => this.finish((session, text) => session.onCommit(text)));
    this.input = input;
    return input;
  }

  /** Closes first, so the blur that hiding the input may cause cannot commit a second time. */
  private finish(action: (session: LabelEditSession, text: string) => void): void {
    const session = this.session;
    const text = this.input?.value ?? '';
    if (session === null) return;
    this.close();
    action(session, text);
  }
}
