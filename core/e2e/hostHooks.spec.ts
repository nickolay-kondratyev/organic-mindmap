import type { Page } from '@playwright/test';
import { HANDLE_GAP, HANDLE_RADIUS, LABEL_EDITOR_ACCESSIBLE_NAME, type NodeId, type Point } from 'organic-mindmap';
import type { MindmapApi } from 'organic-mindmap/react';
import { dragFromTo, nodeBox, nodesAt, viewZoom } from './demoPage';
import { expect, test } from './fixtures';

type DemoWindow = Window & { mindmap?: MindmapApi | null };

/** Screen px above VIDA to drag it to; checked to be bare canvas. */
const EMPTY_SPACE_ABOVE_VIDA_PX = 150;
/** `toBeCloseTo` digits: the centered node must land within half a CSS px of the canvas center. */
const WITHIN_HALF_PX = 0;
/** Screen px per pointer move on the way to where the "+" would be, like a real mouse. */
const POINTER_STEP_PX = 1;

function clickReadout(page: Page) {
  return page.getByTestId('node-click');
}

function labelEditor(page: Page) {
  return page.getByRole('textbox', { name: LABEL_EDITOR_ACCESSIBLE_NAME });
}

async function canvasCenter(page: Page): Promise<Point> {
  const canvas = await page.getByTestId('mindmap-canvas').boundingBox();
  if (canvas === null) throw new Error('The mindmap canvas is not visible');
  return { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };
}

async function centerOnNode(page: Page, nodeId: NodeId): Promise<void> {
  await page.evaluate((id) => (window as DemoWindow).mindmap?.centerOnNode(id), nodeId);
}

test.describe('host hooks for navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await nodeBox(page, 'root');
  });

  test('GIVEN the reference map WHEN Hamlet is clicked with Shift held THEN the host sees the click and the key', async ({ page }) => {
    const hamlet = await nodeBox(page, 'hamlet');
    await page.keyboard.down('Shift');
    await page.mouse.click(hamlet.center.x, hamlet.center.y);
    await page.keyboard.up('Shift');
    await expect(clickReadout(page)).toHaveText('Last clicked: Hamlet (Shift)');
  });

  test('GIVEN the reference map WHEN VIDA is dragged and dropped THEN the host sees no click', async ({ page }) => {
    const vida = await nodeBox(page, 'vida');
    const dropPoint = { x: vida.center.x, y: vida.center.y - EMPTY_SPACE_ABOVE_VIDA_PX };
    expect(await nodesAt(page, dropPoint), 'the drop point must be bare canvas').toEqual([]);
    await dragFromTo(page, vida.center, dropPoint);
    await expect.poll(async () => (await nodeBox(page, 'vida')).center.y).toBeCloseTo(dropPoint.y, WITHIN_HALF_PX);
    await expect(clickReadout(page)).toHaveText('No node clicked yet.');
  });

  test('GIVEN the reference map WHEN the host centers on Hamlet THEN Hamlet is drawn at the canvas center', async ({ page }) => {
    await centerOnNode(page, 'hamlet');
    const center = await canvasCenter(page);
    await expect.poll(async () => (await nodeBox(page, 'hamlet')).center.x).toBeCloseTo(center.x, WITHIN_HALF_PX);
  });

  test.describe('GIVEN adding and renaming switched off in the settings panel', () => {
    test.beforeEach(async ({ page }) => {
      // The section is collapsed by default.
      await page.getByText('Interaction', { exact: true }).click();
      await page.getByTestId('setting:interaction.allowAdd').uncheck();
      await page.getByTestId('setting:interaction.allowRename').uncheck();
    });

    test('WHEN the pointer goes from VIDA to where its "+" was and clicks THEN no label editor opens', async ({ page }) => {
      const vida = await nodeBox(page, 'vida');
      const zoom = await viewZoom(page);
      const plus = { x: vida.center.x + vida.size.width / 2 + (HANDLE_GAP + HANDLE_RADIUS) * zoom, y: vida.center.y };
      await page.mouse.move(vida.center.x, vida.center.y);
      await page.mouse.move(plus.x, plus.y, { steps: Math.ceil((plus.x - vida.center.x) / POINTER_STEP_PX) });
      await page.mouse.click(plus.x, plus.y);
      // A later click the host does see proves the click on the "+" spot was handled before the check below.
      await page.mouse.click(vida.center.x, vida.center.y);
      await expect(clickReadout(page)).toHaveText('Last clicked: VIDA');
      await expect(labelEditor(page)).toBeHidden();
    });

    test('WHEN Hamlet is double-clicked THEN no label editor opens', async ({ page }) => {
      const hamlet = await nodeBox(page, 'hamlet');
      await page.mouse.dblclick(hamlet.center.x, hamlet.center.y);
      await expect(clickReadout(page)).toHaveText('Last clicked: Hamlet');
      await expect(labelEditor(page)).toBeHidden();
    });
  });
});
