import type { Point } from '../model/node';

/**
 * Creates a DOM element floating over the canvas, inserted right after it. Absolute positioning resolves against
 * the same ancestor as `canvas.offsetLeft/Top` (the nearest positioned one), so `placeOver` lines it up with canvas
 * pixels without the host having to wrap the canvas. Ceiling: CSS transforms on the canvas are not accounted for.
 */
export function createCanvasOverlayElement<K extends keyof HTMLElementTagNameMap>(
  canvas: HTMLCanvasElement,
  tag: K,
): HTMLElementTagNameMap[K] {
  const element = canvas.ownerDocument.createElement(tag);
  element.style.position = 'absolute';
  element.style.boxSizing = 'border-box';
  canvas.insertAdjacentElement('afterend', element);
  return element;
}

/** Positions `element`'s top-left corner at `canvasPoint` (CSS px relative to the canvas). */
export function placeOverCanvas(element: HTMLElement, canvas: HTMLCanvasElement, canvasPoint: Point): void {
  element.style.left = `${canvas.offsetLeft + canvasPoint.x}px`;
  element.style.top = `${canvas.offsetTop + canvasPoint.y}px`;
}
