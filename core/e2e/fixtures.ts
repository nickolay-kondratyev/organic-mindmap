import { test as base } from '@playwright/test';
import { VENDORED_KALAM_TTF_PATH } from '../test-support/vendoredKalam';

/** Font requests (the default Fontsource URL) are answered from the vendored TTF. */
export const FONT_URL_GLOB = '**/*.ttf';

/**
 * Every test runs offline: requests leaving localhost are aborted, fonts come from the vendored file.
 * Tests can override fonts with their own `page.route(FONT_URL_GLOB, ...)`; the latest matching route wins.
 */
export const test = base.extend<{ offlineWithVendoredFonts: void }>({
  offlineWithVendoredFonts: [
    async ({ page }, use) => {
      await page.route('**/*', (route) =>
        new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort(),
      );
      await page.route(FONT_URL_GLOB, (route) => route.fulfill({ path: VENDORED_KALAM_TTF_PATH, contentType: 'font/ttf' }));
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
