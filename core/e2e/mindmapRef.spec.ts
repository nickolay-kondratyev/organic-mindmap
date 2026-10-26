import type { MindmapApi } from 'organic-mindmap/react';
import { expect, test } from './fixtures';

/** What the probe saw each time the demo assigned `window.mindmap` a non-null API. */
const USABLE = 'usable';
type ProbedWindow = Window & { mindmapProbe: string[] };

/**
 * `<Mindmap>` must attach its ref only once the core is mounted: the demo exposes the ref as `window.mindmap`, and
 * a ref attached earlier made E2E helpers flake with "The mindmap is not mounted yet". The probe calls the API the
 * instant it is assigned, which hits that window deterministically instead of by timing luck.
 */
test.describe('GIVEN a probe that calls the map API the moment the demo exposes it', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((usable) => {
      const probed = window as unknown as ProbedWindow & { probedApi: MindmapApi | null };
      probed.mindmapProbe = [];
      Object.defineProperty(window, 'mindmap', {
        configurable: true,
        get: () => probed.probedApi,
        set: (api: MindmapApi | null) => {
          probed.probedApi = api;
          if (api === null) return;
          try {
            api.getView();
            probed.mindmapProbe.push(usable);
          } catch (error) {
            probed.mindmapProbe.push(String(error));
          }
        },
      });
    }, USABLE);
    await page.goto('/');
  });

  test('WHEN the page loads THEN the exposed API is already usable', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => (window as unknown as ProbedWindow).mindmapProbe)).toEqual([USABLE]);
  });

  test('WHEN "Reset map" remounts the map THEN the exposed API is already usable', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => (window as unknown as ProbedWindow).mindmapProbe)).toEqual([USABLE]);
    await page.getByRole('button', { name: 'Reset map' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as ProbedWindow).mindmapProbe)).toEqual([USABLE, USABLE]);
  });
});
