import type { MindmapConfig } from '../config/config';
import type { MindmapExtensions } from '../extensions';
import { HANDLE_RADIUS, nodeBoxOf, sameHandle, type NodeHandle } from '../interaction/hitTest';
import type { NodeId } from '../model/node';
import type { NodeBox } from '../shape/nodeShape';
import type { MindmapView } from '../view/viewController';
import { applySceneTransform, type Viewport } from './canvasRenderer';
import type { Scene } from './scene';

/** Interaction feedback painted over the scene (spec I3-I5). */
export interface InteractionOverlay {
  /** Hover buttons of the hovered node. */
  readonly handles: readonly NodeHandle[];
  readonly hoveredHandle: NodeHandle | null;
  /** Node the host highlights (`setHighlightedNode`), e.g. where its editor cursor is. */
  readonly highlightedNodeId: NodeId | null;
  /** Node a dragged node would be dropped onto (spec I3). */
  readonly dropTargetId: NodeId | null;
  /** Node of a pending edit, shown dimmed with a busy ring (spec I5.2). */
  readonly pendingNodeId: NodeId | null;
  /** Milliseconds timestamp driving the busy ring's motion. */
  readonly timeMs: number;
}

/** Share of the scene's background laid over a pending node, so it reads as "not done yet". */
const PENDING_VEIL_ALPHA = 0.55;
const RING_GAP_PX = 6;
const RING_WIDTH_PX = 3;
const BUSY_DASH_PX = 8;
/** Dash travel speed of the busy ring, in px per millisecond. */
const BUSY_DASH_SPEED = 0.03;
const HANDLE_OUTLINE_WIDTH_PX = 2;
/** Half the length of the "+" strokes, as a fraction of the handle radius. */
const HANDLE_GLYPH_FRACTION = 0.5;
const HANDLE_GLYPH_WIDTH_PX = 2.5;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

export function drawInteractionOverlay(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  config: MindmapConfig,
  extensions: MindmapExtensions,
  viewport: Viewport,
  view: MindmapView,
  overlay: InteractionOverlay,
): void {
  ctx.save();
  applySceneTransform(ctx, viewport, view);
  // Before the drop ring, which wins when both mark the same node during a drag.
  if (overlay.highlightedNodeId !== null) drawRing(ctx, scene, extensions, overlay.highlightedNodeId, config.theme.color.highlight, []);
  if (overlay.dropTargetId !== null) drawRing(ctx, scene, extensions, overlay.dropTargetId, config.theme.color.nodeText, []);
  if (overlay.pendingNodeId !== null) drawPending(ctx, scene, config, extensions, overlay.pendingNodeId, overlay.timeMs);
  for (const handle of overlay.handles) drawHandle(ctx, scene, config, handle, sameHandle(handle, overlay.hoveredHandle));
  ctx.restore();
}

function drawPending(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  config: MindmapConfig,
  extensions: MindmapExtensions,
  nodeId: NodeId,
  timeMs: number,
): void {
  const box = nodeBoxOf(scene, nodeId);
  if (box === null) return;
  const background = config.theme.color.background;
  ctx.save();
  ctx.globalAlpha = PENDING_VEIL_ALPHA;
  extensions.nodeShape.draw(ctx, box, { fill: background, outline: background, outlineWidth: RING_WIDTH_PX });
  ctx.restore();
  ctx.save();
  ctx.lineDashOffset = -timeMs * BUSY_DASH_SPEED;
  drawRing(ctx, scene, extensions, nodeId, config.theme.color.nodeText, [BUSY_DASH_PX, BUSY_DASH_PX]);
  ctx.restore();
}

/** Outline of the node's own shape, grown by a small gap; drawn with the shape seam so any shape works. */
function drawRing(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  extensions: MindmapExtensions,
  nodeId: NodeId,
  color: string,
  dash: readonly number[],
): void {
  const box = nodeBoxOf(scene, nodeId);
  if (box === null) return;
  ctx.save();
  ctx.setLineDash(dash);
  extensions.nodeShape.draw(ctx, grown(box, RING_GAP_PX), { fill: TRANSPARENT, outline: color, outlineWidth: RING_WIDTH_PX });
  ctx.restore();
}

function drawHandle(ctx: CanvasRenderingContext2D, scene: Scene, config: MindmapConfig, handle: NodeHandle, hovered: boolean): void {
  const color = scene.colors.get(handle.nodeId);
  if (color === undefined) return;
  const { x, y } = handle.center;
  ctx.beginPath();
  ctx.arc(x, y, HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = hovered ? color.fill : color.outline;
  ctx.fill();
  ctx.lineWidth = HANDLE_OUTLINE_WIDTH_PX;
  ctx.strokeStyle = config.theme.color.nodeText;
  ctx.stroke();

  const arm = HANDLE_RADIUS * HANDLE_GLYPH_FRACTION;
  ctx.beginPath();
  ctx.moveTo(x - arm, y);
  ctx.lineTo(x + arm, y);
  ctx.moveTo(x, y - arm);
  ctx.lineTo(x, y + arm);
  ctx.lineWidth = HANDLE_GLYPH_WIDTH_PX;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function grown(box: NodeBox, by: number): NodeBox {
  return { center: box.center, size: { width: box.size.width + 2 * by, height: box.size.height + 2 * by } };
}
