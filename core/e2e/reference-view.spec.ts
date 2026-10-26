import { expect, test } from './fixtures';

/** Fixed viewport and DPR so the fit-to-content zoom, and therefore every pixel, is the same on every run. */
const REFERENCE_VIEWPORT = { width: 1400, height: 900 };
const REFERENCE_PAGE = '/reference.html';

test.use({ viewport: REFERENCE_VIEWPORT, deviceScaleFactor: 1 });

/** Resolves once the fonts are loaded and the repaint that draws the labels has run. */
async function openPaintedReferenceView(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(REFERENCE_PAGE);
  await expect(page.locator('body')).toHaveAttribute('data-font-status', 'loaded');
  // The font-loaded status fires before the repaint it requests; two frames cover that paint and the
  // follow-up frame the initial fit schedules.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test.describe('reference view (spec §8, Q3)', () => {
  test('GIVEN the reference data with zero config WHEN painted THEN it matches the acceptance screenshot', async ({ page }) => {
    await openPaintedReferenceView(page);
    await expect(page).toHaveScreenshot('reference-view.png');
  });

  test('GIVEN the same data WHEN painted twice THEN the pixels are identical (spec Q1)', async ({ page }) => {
    const paint = async () => {
      await openPaintedReferenceView(page);
      return page.getByTestId('reference-canvas').evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    };
    const first = await paint();
    const second = await paint();
    expect(second).toBe(first);
  });
});
