import type { Page } from '@playwright/test';
import {
  DEFAULT_VIEW,
  LABEL_EDITOR_ACCESSIBLE_NAME,
  type MindmapData,
  type MindmapView,
  type NodeBox,
  type NodeId,
  type Point,
} from 'organic-mindmap';
import type { MindmapApi } from 'organic-mindmap/react';

/** Canvas content has no DOM, so tests read the map through the demo's `window.mindmap` (demo/testHooks.ts). */
type DemoWindow = Window & { mindmap?: MindmapApi | null };

/** Several pointer moves per drag, so it crosses the drag threshold like a real hand would. */
const DRAG_STEPS = 12;

async function canvasBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const canvas = await page.getByTestId('mindmap-canvas').boundingBox();
  if (canvas === null) throw new Error('The mindmap canvas is not visible');
  return canvas;
}

/** Node box in page coordinates, waiting until the node has been painted. */
export async function nodeBox(page: Page, nodeId: NodeId): Promise<NodeBox> {
  const handle = await page.waitForFunction((id) => (window as DemoWindow).mindmap?.getNodeScreenBox(id) ?? null, nodeId);
  const box = (await handle.jsonValue()) as NodeBox;
  const canvas = await canvasBox(page);
  return { center: { x: canvas.x + box.center.x, y: canvas.y + box.center.y }, size: box.size };
}

/** Ids of the nodes whose box covers `point` (page coordinates); empty when the point is on bare canvas. */
export async function nodesAt(page: Page, point: Point): Promise<NodeId[]> {
  const covering: NodeId[] = [];
  for (const { id } of await hostData(page)) {
    const { center, size } = await nodeBox(page, id);
    if (Math.abs(point.x - center.x) <= size.width / 2 && Math.abs(point.y - center.y) <= size.height / 2) covering.push(id);
  }
  return covering;
}

/**
 * A page point `insetPx` below the canvas's top edge, horizontally centered, checked to be off every node.
 * WHY centered: the demo's font badge sits in the top-left corner while fonts load.
 */
export async function emptyCanvasPoint(page: Page, insetPx: number): Promise<Point> {
  const canvas = await canvasBox(page);
  const point = { x: canvas.x + canvas.width / 2, y: canvas.y + insetPx };
  const covering = await nodesAt(page, point);
  if (covering.length > 0) throw new Error(`Expected bare canvas at point=[${JSON.stringify(point)}], covered by nodes=[${covering}]`);
  return point;
}

export async function viewOf(page: Page): Promise<MindmapView> {
  return page.evaluate((fallback) => (window as DemoWindow).mindmap?.getView() ?? fallback, DEFAULT_VIEW);
}

export async function viewZoom(page: Page): Promise<number> {
  return (await viewOf(page)).zoom;
}

export async function hostData(page: Page): Promise<MindmapData> {
  return page.evaluate(() => (window as DemoWindow).mindmap?.getData() ?? []);
}

export async function textOf(page: Page, nodeId: NodeId): Promise<string | undefined> {
  return (await hostData(page)).find((node) => node.id === nodeId)?.text;
}

export async function renameByDoubleClick(page: Page, nodeId: NodeId, label: string): Promise<void> {
  const { center } = await nodeBox(page, nodeId);
  await page.mouse.dblclick(center.x, center.y);
  await page.getByRole('textbox', { name: LABEL_EDITOR_ACCESSIBLE_NAME }).fill(label);
  await page.keyboard.press('Enter');
}

/** Presses at `from`, drags to `to` and releases, in page coordinates. */
export async function dragFromTo(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: DRAG_STEPS });
  await page.mouse.up();
}
