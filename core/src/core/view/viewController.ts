import type { Point } from '../model/node';
import { fitView, type ContentBounds, type ViewportSize } from './fitView';

/**
 * Library-local view (spec I1): `screen = viewportCenter + offset + zoom * scene`, in CSS pixels.
 * Centre-relative so the default view keeps the root centred whatever the canvas size.
 */
export interface MindmapView {
  readonly offset: Point;
  readonly zoom: number;
}

export const DEFAULT_VIEW: MindmapView = { offset: { x: 0, y: 0 }, zoom: 1 };
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 5;
/** Zoom factor of one zoom-in / zoom-out API step (host buttons). */
export const ZOOM_STEP_FACTOR = 1.2;
/** Zoom grows by `exp(-deltaY * this)`: exponential so equal wheel distances give equal zoom ratios. */
export const WHEEL_ZOOM_SENSITIVITY = 0.002;

/**
 * Pan/zoom state. View changes never need host confirmation (I1); user-driven changes are reported via
 * `onChange` so the host can observe them, while `setView` (the host's own write) is not echoed back.
 * The initial view fits the whole map (`setContentBounds` once the viewport has a size) and `reset` returns to it.
 */
export class ViewController {
  private current: MindmapView = DEFAULT_VIEW;
  private viewportCenter: Point = { x: 0, y: 0 };
  private contentBounds: ContentBounds | null = null;
  private initialFitDone = false;

  constructor(private readonly onChange: (view: MindmapView) => void) {}

  get view(): MindmapView {
    return this.current;
  }

  /** The host's own write (e.g. a restored view): never echoed, and it takes precedence over the initial fit. */
  setView(view: MindmapView): void {
    this.initialFitDone = true;
    this.current = { offset: view.offset, zoom: clampZoom(view.zoom) };
  }

  /** CSS-pixel size of the canvas; needed to map screen points (cursor) to scene points. */
  setViewportSize(width: number, height: number): void {
    this.viewportCenter = { x: width / 2, y: height / 2 };
  }

  panBy(delta: Point): void {
    const { offset, zoom } = this.current;
    this.update({ offset: { x: offset.x + delta.x, y: offset.y + delta.y }, zoom });
  }

  /** Multiplies the zoom by `factor` (clamped) keeping the scene point under `screenPoint` in place. */
  zoomAt(screenPoint: Point, factor: number): void {
    const anchor = this.screenToScene(screenPoint);
    const zoom = clampZoom(this.current.zoom * factor);
    this.update({
      offset: {
        x: screenPoint.x - this.viewportCenter.x - zoom * anchor.x,
        y: screenPoint.y - this.viewportCenter.y - zoom * anchor.y,
      },
      zoom,
    });
  }

  /** Wheel zoom anchored at the cursor; `deltaY` as in `WheelEvent.deltaY` (negative = zoom in). */
  zoomByWheel(screenPoint: Point, deltaY: number): void {
    this.zoomAt(screenPoint, Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY));
  }

  zoomIn(): void {
    this.zoomAt(this.viewportCenter, ZOOM_STEP_FACTOR);
  }

  zoomOut(): void {
    this.zoomAt(this.viewportCenter, 1 / ZOOM_STEP_FACTOR);
  }

  /** Pans so `scenePoint` sits at the viewport center, keeping the zoom (e.g. to follow the host's editor cursor). */
  centerOn(scenePoint: Point): void {
    const { zoom } = this.current;
    // From `screen = viewportCenter + offset + zoom * scene` with `screen = viewportCenter`.
    this.update({ offset: { x: -zoom * scenePoint.x, y: -zoom * scenePoint.y }, zoom });
  }

  /**
   * Extent of the painted map, refreshed on every paint so `reset` fits what is on screen. The first call with
   * a sized viewport also performs the initial fit; a 0x0 viewport (hidden canvas) defers it to a later paint.
   */
  setContentBounds(bounds: ContentBounds | null): void {
    this.contentBounds = bounds;
    if (this.initialFitDone || bounds === null || this.viewportCenter.x === 0 || this.viewportCenter.y === 0) return;
    this.initialFitDone = true;
    this.reset();
  }

  /** Fits the whole map with a margin (spec I1 reset); without content bounds, the root-centered default view. */
  reset(): void {
    const target = this.contentBounds === null ? DEFAULT_VIEW : fitView(this.contentBounds, this.viewportSize());
    this.update({ offset: target.offset, zoom: clampZoom(target.zoom) });
  }

  screenToScene(point: Point): Point {
    const { offset, zoom } = this.current;
    return {
      x: (point.x - this.viewportCenter.x - offset.x) / zoom,
      y: (point.y - this.viewportCenter.y - offset.y) / zoom,
    };
  }

  sceneToScreen(point: Point): Point {
    const { offset, zoom } = this.current;
    return {
      x: this.viewportCenter.x + offset.x + zoom * point.x,
      y: this.viewportCenter.y + offset.y + zoom * point.y,
    };
  }

  private viewportSize(): ViewportSize {
    return { width: this.viewportCenter.x * 2, height: this.viewportCenter.y * 2 };
  }

  private update(view: MindmapView): void {
    // E.g. wheeling further at a zoom limit: nothing moved, so nothing to report or repaint.
    if (sameView(view, this.current)) return;
    // Any view change before the first sized paint (host reset, early pan) is the user's choice; do not fit over it.
    this.initialFitDone = true;
    this.current = view;
    this.onChange(view);
  }
}

function sameView(a: MindmapView, b: MindmapView): boolean {
  return a.zoom === b.zoom && a.offset.x === b.offset.x && a.offset.y === b.offset.y;
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
