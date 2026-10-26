import type { NodePositions } from '../layout/layoutTypes';
import type { NodeSizeMap } from '../size/nodeSizeResolver';
import type { MindmapView } from './viewController';

/** Axis-aligned extent of the painted map in scene coordinates. */
export interface ContentBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/** Empty space kept between the map and the canvas edge when fitting, in CSS px. */
export const FIT_MARGIN_PX = 48;
/**
 * Fit never enlarges beyond the designed size: a three-node map blown up to fill a wide canvas looks wrong,
 * while shrinking a large map so it is all visible is the whole point (spec: initial view fits the map).
 */
export const FIT_MAX_ZOOM = 1;

/**
 * Union of the node boxes. Branches run between nodes, so node boxes bound the map; the few px a routed limb
 * may bulge past them are covered by the fit margin.
 */
export function contentBounds(positions: NodePositions, sizes: NodeSizeMap): ContentBounds | null {
  let bounds: ContentBounds | null = null;
  for (const [id, center] of positions) {
    const size = sizes.get(id);
    if (size === undefined) continue;
    const box: ContentBounds = {
      minX: center.x - size.width / 2,
      minY: center.y - size.height / 2,
      maxX: center.x + size.width / 2,
      maxY: center.y + size.height / 2,
    };
    bounds =
      bounds === null
        ? box
        : {
            minX: Math.min(bounds.minX, box.minX),
            minY: Math.min(bounds.minY, box.minY),
            maxX: Math.max(bounds.maxX, box.maxX),
            maxY: Math.max(bounds.maxY, box.maxY),
          };
  }
  return bounds;
}

/**
 * The view that shows all of `bounds` centered in the viewport with `FIT_MARGIN_PX` free on every side,
 * zoomed out as needed but never past `FIT_MAX_ZOOM`. Uses the `screen = viewportCenter + offset + zoom * scene`
 * mapping of `ViewController`.
 */
export function fitView(bounds: ContentBounds, viewport: ViewportSize): MindmapView {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const availableWidth = Math.max(0, viewport.width - 2 * FIT_MARGIN_PX);
  const availableHeight = Math.max(0, viewport.height - 2 * FIT_MARGIN_PX);
  const zoom = Math.min(
    FIT_MAX_ZOOM,
    contentWidth > 0 ? availableWidth / contentWidth : FIT_MAX_ZOOM,
    contentHeight > 0 ? availableHeight / contentHeight : FIT_MAX_ZOOM,
  );
  const contentCenterX = (bounds.minX + bounds.maxX) / 2;
  const contentCenterY = (bounds.minY + bounds.maxY) / 2;
  // The content center must land on the viewport center, so the offset cancels its zoomed scene position.
  return { offset: { x: -zoom * contentCenterX, y: -zoom * contentCenterY }, zoom };
}
