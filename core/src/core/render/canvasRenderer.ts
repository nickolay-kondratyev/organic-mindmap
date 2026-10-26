import type { MindmapConfig } from '../config/config';
import type { MindmapExtensions } from '../extensions';
import { taperedOutline, type BranchOutline } from '../geometry/taperedOutline';
import type { LabelFonts } from '../text/labelFontLoader';
import { drawLabels, type LabelFallback } from './labelRenderer';
import type { Scene } from './scene';
import type { MindmapView } from '../view/viewController';

/** Canvas size in CSS pixels plus the device pixel ratio the backing store was scaled by. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
}

const NODE_OUTLINE_WIDTH_PX = 2;

/**
 * Draws a scene: background, filled tapered limbs under nodes (spec R5, R9), node shapes, then glyph-outline
 * labels (R17).
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  config: MindmapConfig,
  extensions: MindmapExtensions,
  viewport: Viewport,
  view: MindmapView,
  fonts: LabelFonts,
  fallback: LabelFallback,
): void {
  ctx.setTransform(viewport.devicePixelRatio, 0, 0, viewport.devicePixelRatio, 0, 0);
  ctx.fillStyle = config.theme.color.background;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  applySceneTransform(ctx, viewport, view);

  for (const branch of scene.branches) {
    const color = scene.colors.get(branch.childId);
    if (color === undefined) continue;
    fillOutline(ctx, taperedOutline(branch, config.branch.asymmetry), color.fill);
  }

  for (const node of scene.tree.nodes) {
    const center = scene.positions.get(node.id);
    const size = scene.sizes.get(node.id);
    const color = scene.colors.get(node.id);
    if (center === undefined || size === undefined || color === undefined) continue;
    extensions.nodeShape.draw(ctx, { center, size }, { ...color, outlineWidth: NODE_OUTLINE_WIDTH_PX });
  }

  drawLabels(ctx, scene, config, extensions, fonts, fallback);
}

/** Maps scene coordinates onto the canvas: the same mapping as `ViewController.sceneToScreen` (spec I1). */
export function applySceneTransform(ctx: CanvasRenderingContext2D, viewport: Viewport, view: MindmapView): void {
  ctx.setTransform(viewport.devicePixelRatio, 0, 0, viewport.devicePixelRatio, 0, 0);
  // Scene coordinates put the root at (0,0); center it in the viewport.
  ctx.translate(viewport.width / 2, viewport.height / 2);
  ctx.translate(view.offset.x, view.offset.y);
  ctx.scale(view.zoom, view.zoom);
}

function fillOutline(ctx: CanvasRenderingContext2D, outline: BranchOutline, fill: string): void {
  const first = outline[0];
  if (first === undefined) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const point of outline.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
