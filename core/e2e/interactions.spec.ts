import type { Page } from '@playwright/test';
import { HANDLE_GAP, HANDLE_RADIUS, LABEL_EDITOR_ACCESSIBLE_NAME, REPARENT_DIALOG_LABELS, type NodeId, type Point } from 'organic-mindmap';
import { DEMO_REJECTION_REASON } from '../demo/host/demoHost';
import { dragFromTo, emptyCanvasPoint, hostData, nodeBox, nodesAt, renameByDoubleClick, textOf, viewOf, viewZoom } from './demoPage';
import { expect, test } from './fixtures';

/** Screen px above VIDA to drop it at; the test checks no node is there (the topmost, Hamlet, is ~25 px above VIDA). */
const EMPTY_SPACE_ABOVE_VIDA_PX = 150;
/** How far below the canvas top edge the pan / wheel point sits; the fitted map leaves a wider margin above it. */
const EMPTY_CANVAS_INSET_PX = 40;
const PAN_DELTA: Point = { x: 80, y: 50 };
/** Negative = zoom in, like `WheelEvent.deltaY`. */
const WHEEL_ZOOM_IN_DELTA_Y = -200;
/** `toBeCloseTo` digits: the drop must land within half a CSS px of the pointer. */
const WITHIN_HALF_PX = 0;
/** Screen px per pointer move on the way to a "+": finer than the gap before it, like a real mouse. */
const POINTER_STEP_PX = 1;

async function parentOf(page: Page, nodeId: NodeId): Promise<NodeId | null | undefined> {
  return (await hostData(page)).find((node) => node.id === nodeId)?.parentId;
}

test.describe('canvas interactions (spec I1-I5)', () => {
  test('GIVEN the reference map WHEN the pointer moves from VIDA to its "+", clicks it and types a label THEN the host gets a new child of VIDA', async ({
    page,
  }) => {
    await page.goto('/');
    const vida = await nodeBox(page, 'vida');
    const zoom = await viewZoom(page);
    // VIDA is on the right side; take its outer "+", just right of it.
    const plus = { x: vida.center.x + vida.size.width / 2 + (HANDLE_GAP + HANDLE_RADIUS) * zoom, y: vida.center.y };
    await page.mouse.move(vida.center.x, vida.center.y);
    await page.mouse.move(plus.x, plus.y, { steps: Math.ceil((plus.x - vida.center.x) / POINTER_STEP_PX) });
    await page.mouse.click(plus.x, plus.y);
    await page.getByRole('textbox', { name: LABEL_EDITOR_ACCESSIBLE_NAME }).fill('Romeo');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await hostData(page)).find((node) => node.text === 'Romeo')?.parentId).toBe('vida');
  });

  test('GIVEN the reference map WHEN Hamlet is double-clicked and renamed THEN the host has the new label', async ({ page }) => {
    await page.goto('/');
    await renameByDoubleClick(page, 'hamlet', 'Ophelia');
    await expect.poll(() => textOf(page, 'hamlet')).toBe('Ophelia');
  });

  test.describe('GIVEN Hamlet dragged onto POESIA (spec I3)', () => {
    let hamletStart: Point;
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      hamletStart = (await nodeBox(page, 'hamlet')).center;
      const poesia = await nodeBox(page, 'poesia');
      await dragFromTo(page, hamletStart, poesia.center);
    });

    test('WHEN the question is confirmed THEN the host moves Hamlet under POESIA', async ({ page }) => {
      await page.getByRole('dialog', { name: 'Make "Hamlet" a child of "POESIA"?' }).getByRole('button', { name: REPARENT_DIALOG_LABELS.confirm }).click();
      await expect.poll(() => parentOf(page, 'hamlet')).toBe('poesia');
    });

    test('WHEN the question is cancelled THEN Hamlet is drawn where it was before the drag', async ({ page }) => {
      await page.getByRole('button', { name: REPARENT_DIALOG_LABELS.cancel }).click();
      await expect.poll(async () => (await nodeBox(page, 'hamlet')).center.y).toBeCloseTo(hamletStart.y, WITHIN_HALF_PX);
    });

    test('WHEN the question is cancelled THEN the host keeps Hamlet under VIDA', async ({ page }) => {
      await page.getByRole('button', { name: REPARENT_DIALOG_LABELS.cancel }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      expect(await parentOf(page, 'hamlet')).toBe('vida');
    });

    test('WHEN confirmed with "Don\'t ask again" THEN the setting to ask is off in the settings panel', async ({ page }) => {
      await page.getByRole('checkbox', { name: REPARENT_DIALOG_LABELS.dontAskAgain }).check();
      await page.getByRole('button', { name: REPARENT_DIALOG_LABELS.confirm }).click();
      await expect(page.getByTestId('setting:interaction.confirmReparent')).not.toBeChecked();
    });
  });

  test.describe('GIVEN VIDA dragged into empty space above it (spec I2)', () => {
    let dropPoint: Point;
    let hamletStart: Point;
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      const vida = await nodeBox(page, 'vida');
      hamletStart = (await nodeBox(page, 'hamlet')).center;
      dropPoint = { x: vida.center.x, y: vida.center.y - EMPTY_SPACE_ABOVE_VIDA_PX };
      expect(await nodesAt(page, dropPoint), 'the drop point must be bare canvas').toEqual([]);
      await dragFromTo(page, vida.center, dropPoint);
    });

    test('WHEN dropped THEN VIDA is drawn at the drop point', async ({ page }) => {
      await expect.poll(async () => (await nodeBox(page, 'vida')).center.y).toBeCloseTo(dropPoint.y, WITHIN_HALF_PX);
    });

    test('WHEN dropped THEN its child Hamlet moved along with it', async ({ page }) => {
      const expectedY = hamletStart.y - EMPTY_SPACE_ABOVE_VIDA_PX;
      await expect.poll(async () => (await nodeBox(page, 'hamlet')).center.y).toBeCloseTo(expectedY, WITHIN_HALF_PX);
    });

    test('WHEN dropped THEN the host data keeps VIDA under the root', async ({ page }) => {
      await expect.poll(async () => (await nodeBox(page, 'vida')).center.y).toBeCloseTo(dropPoint.y, WITHIN_HALF_PX);
      expect((await hostData(page)).find((node) => node.id === 'vida')?.parentId).toBe('root');
    });
  });

  test('GIVEN the reference map WHEN VIDA is dragged across the root to the left THEN its child Hamlet flips to VIDA\'s far (left) side', async ({
    page,
  }) => {
    await page.goto('/');
    const root = await nodeBox(page, 'root');
    const vida = await nodeBox(page, 'vida');
    expect(await nodeBox(page, 'hamlet').then((hamlet) => hamlet.center.x), 'Hamlet starts right of VIDA').toBeGreaterThan(vida.center.x);
    const dropPoint = { x: root.center.x - (vida.center.x - root.center.x), y: vida.center.y - EMPTY_SPACE_ABOVE_VIDA_PX };
    expect(await nodesAt(page, dropPoint), 'the drop point must be bare canvas').toEqual([]);
    await dragFromTo(page, vida.center, dropPoint);
    await expect.poll(async () => (await nodeBox(page, 'vida')).center.x).toBeCloseTo(dropPoint.x, WITHIN_HALF_PX);
    expect((await nodeBox(page, 'hamlet')).center.x).toBeLessThan(dropPoint.x);
  });

  test.describe('GIVEN the reference map and a point on bare canvas (spec I1)', () => {
    let emptyPoint: Point;
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await nodeBox(page, 'root');
      emptyPoint = await emptyCanvasPoint(page, EMPTY_CANVAS_INSET_PX);
    });

    test('WHEN empty canvas is dragged THEN the view pans by the drag distance', async ({ page }) => {
      const before = await viewOf(page);
      const to = { x: emptyPoint.x + PAN_DELTA.x, y: emptyPoint.y + PAN_DELTA.y };
      await dragFromTo(page, emptyPoint, to);
      // Rounded: the drag arrives as several fractional pointer moves whose float sum is not exact.
      await expect
        .poll(async () => {
          const { offset } = await viewOf(page);
          return { x: Math.round(offset.x - before.offset.x), y: Math.round(offset.y - before.offset.y) };
        })
        .toEqual(PAN_DELTA);
    });

    test('WHEN the wheel scrolls up over the canvas THEN the view zooms in', async ({ page }) => {
      const before = await viewZoom(page);
      await page.mouse.move(emptyPoint.x, emptyPoint.y);
      await page.mouse.wheel(0, WHEEL_ZOOM_IN_DELTA_Y);
      await expect.poll(() => viewZoom(page)).toBeGreaterThan(before);
    });
  });

  test.describe('GIVEN the runner host is set to reject every change (spec D5)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.getByRole('checkbox', { name: 'Reject every change' }).check();
      await renameByDoubleClick(page, 'hamlet', 'Ophelia');
    });

    test('WHEN a rename is sent THEN the host reason is shown', async ({ page }) => {
      await expect(page.getByRole('alert')).toContainText(DEMO_REJECTION_REASON);
    });

    test('WHEN a rename is rejected THEN the typed label is offered again for retry', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: LABEL_EDITOR_ACCESSIBLE_NAME })).toHaveValue('Ophelia');
    });
  });
});
