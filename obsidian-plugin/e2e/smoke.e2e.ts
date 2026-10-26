import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SHOW_STATUS_COMMAND } from '../src/commands';
import { ObsidianHarness, PLUGIN_ID } from './obsidianHarness';

/**
 * Smoke journey: a real Obsidian boots the dev vault, loads the plugin, and its command is registered and runs.
 * Serial by design: ONE Obsidian instance for the whole file. `../src/commands` is safe to import here because it
 * does not import `obsidian`.
 */
test.describe.configure({ mode: 'serial' });

/** A note seeded by scripts/setup-dev-vault.sh. */
const FIXTURE_NOTE_PATH = 'Welcome.md';
const SHOW_STATUS_COMMAND_ID = `${PLUGIN_ID}:${SHOW_STATUS_COMMAND.id}`;

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
  harness = await ObsidianHarness.launch();
  page = harness.page;
});

test.afterAll(async () => {
  await harness?.close();
});

test('plugin is loaded and enabled', async () => {
  const loaded = await page.evaluate(
    (pluginId) => Boolean((window as unknown as { app: any }).app.plugins.plugins[pluginId]),
    PLUGIN_ID,
  );
  expect(loaded).toBe(true);
});

test('the status command is registered', async () => {
  expect(await harness.hasCommand(SHOW_STATUS_COMMAND_ID)).toBe(true);
});

test('running the status command shows a notice naming the plugin', async () => {
  await harness.runCommand(SHOW_STATUS_COMMAND_ID);
  await expect(page.locator('.notice', { hasText: 'Organic Mindmap' })).toBeVisible();
});

test('opening a fixture note makes it the active file', async () => {
  await harness.openFile(FIXTURE_NOTE_PATH);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { app: any }).app.workspace.getActiveFile()?.path ?? null))
    .toBe(FIXTURE_NOTE_PATH);
});
