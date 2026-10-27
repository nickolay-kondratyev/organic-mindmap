import { createCanvasOverlayElement, placeOverCanvas } from './canvasOverlayElement';

const TOP_MARGIN_PX = 12;
const DISMISS_LABEL = 'Dismiss';
const NOTICE_CLASS = 'organic-mindmap-notice';

/**
 * Plain-language message over the top of the canvas (spec I5.4): why an edit was rejected by the host or refused
 * before sending. `role="alert"` so screen readers announce it. Created on first use.
 */
export class NoticeBanner {
  private element: HTMLDivElement | null = null;
  private text: HTMLSpanElement | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onDismiss: () => void,
  ) {}

  show(message: string): void {
    const element = this.element ?? this.create();
    (this.text as HTMLSpanElement).textContent = message;
    element.hidden = false;
    this.place();
  }

  hide(): void {
    if (this.element !== null) this.element.hidden = true;
  }

  /** Keeps it centred over the canvas when the canvas moves or resizes. */
  place(): void {
    if (this.element === null || this.element.hidden) return;
    placeOverCanvas(this.element, this.canvas, { x: this.canvas.clientWidth / 2, y: TOP_MARGIN_PX });
  }

  dispose(): void {
    this.element?.remove();
    this.element = null;
  }

  private create(): HTMLDivElement {
    const element = createCanvasOverlayElement(this.canvas, 'div', NOTICE_CLASS);
    element.setAttribute('role', 'alert');
    const text = element.ownerDocument.createElement('span');
    const dismiss = element.ownerDocument.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = DISMISS_LABEL;
    dismiss.addEventListener('click', () => {
      this.hide();
      this.onDismiss();
    });
    element.append(text, dismiss);
    this.element = element;
    this.text = text;
    return element;
  }
}
