import type { NodeSize, Point } from '../model/node';

export interface NodeBox {
  readonly center: Point;
  readonly size: NodeSize;
}

export interface NodeFillStyle {
  readonly fill: string;
  readonly outline: string;
  readonly outlineWidth: number;
}

/**
 * Node shape seam (spec R2, L5): ellipse by default, swappable by composition. `rimPoint` is what
 * branch geometry and text centering use to find where a limb meets the node.
 */
export interface NodeShape {
  draw(ctx: CanvasRenderingContext2D, box: NodeBox, style: NodeFillStyle): void;
  contains(box: NodeBox, point: Point): boolean;
  /** Point on the rim in the given direction (not necessarily unit length) from the center. */
  rimPoint(box: NodeBox, direction: Point): Point;
}

const FULL_TURN = Math.PI * 2;

export const ellipseShape: NodeShape = {
  draw(ctx, box, style) {
    ctx.beginPath();
    ctx.ellipse(box.center.x, box.center.y, box.size.width / 2, box.size.height / 2, 0, 0, FULL_TURN);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.lineWidth = style.outlineWidth;
    ctx.strokeStyle = style.outline;
    ctx.stroke();
  },
  contains(box, point) {
    const nx = (point.x - box.center.x) / (box.size.width / 2);
    const ny = (point.y - box.center.y) / (box.size.height / 2);
    return nx * nx + ny * ny <= 1;
  },
  rimPoint(box, direction) {
    const a = box.size.width / 2;
    const b = box.size.height / 2;
    const magnitude = Math.hypot(direction.x, direction.y);
    if (magnitude === 0) return { x: box.center.x + a, y: box.center.y };
    const ux = direction.x / magnitude;
    const uy = direction.y / magnitude;
    // Scale the unit direction so it lands on the ellipse: (t*ux/a)^2 + (t*uy/b)^2 = 1.
    const t = 1 / Math.sqrt((ux / a) ** 2 + (uy / b) ** 2);
    return { x: box.center.x + ux * t, y: box.center.y + uy * t };
  },
};
