import { createCanvasOverlayElement, placeOverCanvas } from './canvasOverlayElement';

const TOP_MARGIN_PX = 12;
const DISMISS_LABEL = 'Dismiss';

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
    element.style.display = 'flex';
    this.place();
  }

  hide(): void {
    if (this.element !== null) this.element.style.display = 'none';
  }

  /** Keeps it centred over the canvas when the canvas moves or resizes. */
  place(): void {
    if (this.element === null || this.element.style.display === 'none') return;
    placeOverCanvas(this.element, this.canvas, { x: this.canvas.clientWidth / 2, y: TOP_MARGIN_PX });
  }

  dispose(): void {
    this.element?.remove();
    this.element = null;
  }

  private create(): HTMLDivElement {
    const element = createCanvasOverlayElement(this.canvas, 'div');
    element.setAttribute('role', 'alert');
    Object.assign(element.style, {
      transform: 'translateX(-50%)',
      alignItems: 'center',
      gap: '12px',
      maxWidth: '80%',
      padding: '8px 12px',
      borderRadius: '6px',
      background: 'rgba(20, 24, 38, 0.92)',
      border: '1px solid rgba(255, 255, 255, 0.25)',
      color: '#f1f2f6',
      font: '14px system-ui, sans-serif',
    });
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
