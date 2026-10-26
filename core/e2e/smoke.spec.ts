import { expect, test } from './fixtures';

test('demo loads and the canvas renders non-empty', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('mindmap-canvas');
  await expect(canvas).toBeVisible();
  // "Non-empty" = at least two distinct colors painted (background plus something on top).
  await expect
    .poll(async () =>
      canvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const ctx = c.getContext('2d');
        if (ctx === null || c.width === 0) return 0;
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        const colors = new Set<number>();
        const BYTES_PER_PIXEL = 4;
        for (let i = 0; i < data.length; i += BYTES_PER_PIXEL) {
          colors.add(((data[i] as number) << 16) | ((data[i + 1] as number) << 8) | (data[i + 2] as number));
          if (colors.size > 1) break;
        }
        return colors.size;
      }),
    )
    .toBeGreaterThan(1);
});
