import type { Page } from '@playwright/test';
import { SETTINGS_STORAGE_KEY } from '../demo/settings/localStorageSettings';
import { hostData, nodeBox, renameByDoubleClick, textOf } from './demoPage';
import { expect, test } from './fixtures';

const ROOT_WIDTH_SETTING = 'setting:node.rootSize.width';
const WIDER_ROOT_PX = '300';
const HOST_DELAY_MS = '1000';
const LARGE_MAP_NODES = 200;
const PASTED_NOTE = ['Intro text is not a heading.', '# Trip to Rome', '## Flights', '```', '# not a heading', '```', '### Return'].join('\n');

async function mapLabels(page: Page): Promise<string[]> {
  return (await hostData(page)).map((node) => node.text);
}

async function rootWidth(page: Page): Promise<number> {
  return (await nodeBox(page, 'root')).size.width;
}

test.describe('demo runner (spec §6a)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('GIVEN default settings WHEN the root node width is increased THEN the root is drawn wider (D3)', async ({ page }) => {
    const before = await rootWidth(page);
    await page.getByTestId(ROOT_WIDTH_SETTING).fill(WIDER_ROOT_PX);
    await expect.poll(() => rootWidth(page)).toBeGreaterThan(before);
  });

  test('GIVEN a changed setting WHEN settings are reset THEN the root is drawn at its default width again (D3)', async ({ page }) => {
    const before = await rootWidth(page);
    await page.getByTestId(ROOT_WIDTH_SETTING).fill(WIDER_ROOT_PX);
    await expect.poll(() => rootWidth(page)).toBeGreaterThan(before);
    await page.getByRole('button', { name: 'Reset settings' }).click();
    await expect.poll(() => rootWidth(page)).toBe(before);
  });

  test('GIVEN a changed setting WHEN the page is reloaded THEN the setting is kept (settings storage)', async ({ page }) => {
    await page.getByTestId(ROOT_WIDTH_SETTING).fill(WIDER_ROOT_PX);
    // Settings are written asynchronously; reloading before the write would test nothing.
    await page.waitForFunction((key) => window.localStorage.getItem(key) !== null, SETTINGS_STORAGE_KEY);
    await page.reload();
    await expect(page.getByTestId(ROOT_WIDTH_SETTING)).toHaveValue(WIDER_ROOT_PX);
  });

  test('GIVEN a slow host WHEN a node is renamed THEN the change shows as waiting until the host saves it (D5)', async ({ page }) => {
    await page.getByLabel('Answer delay').fill(HOST_DELAY_MS);
    await renameByDoubleClick(page, 'hamlet', 'Ophelia');
    await expect(page.getByTestId('edit-status')).toHaveAttribute('data-kind', 'pending');
    await expect.poll(() => textOf(page, 'hamlet')).toBe('Ophelia');
  });

  test('GIVEN an edited map WHEN "Reset map" is clicked THEN the reference data is back (D6)', async ({ page }) => {
    await renameByDoubleClick(page, 'hamlet', 'Ophelia');
    await expect.poll(() => textOf(page, 'hamlet')).toBe('Ophelia');
    await page.getByRole('button', { name: 'Reset map' }).click();
    await expect.poll(() => textOf(page, 'hamlet')).toBe('Hamlet');
  });

  test('GIVEN the reference map WHEN "Load 200-node map" is clicked THEN the map has 200 nodes', async ({ page }) => {
    await page.getByRole('button', { name: 'Load 200-node map' }).click();
    await expect.poll(async () => (await hostData(page)).length).toBe(LARGE_MAP_NODES);
  });

  test('GIVEN pasted Markdown WHEN "Show headings as map" is clicked THEN the map shows its headings (D7)', async ({ page }) => {
    await page.getByLabel('Markdown note').fill(PASTED_NOTE);
    await page.getByRole('button', { name: 'Show headings as map' }).click();
    await expect.poll(() => mapLabels(page)).toEqual(['Trip to Rome', 'Flights', 'Return']);
  });
});
