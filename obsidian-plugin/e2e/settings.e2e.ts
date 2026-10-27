import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fontChoice } from '../src/settings/fontChoices';
import { MAP_SETTINGS_LABEL } from '../src/mapView/settingsPanelDisclosure';
import { MINDMAP_VIEW_TYPE } from '../src/mapView/viewSwitch';
import { ObsidianHarness, PLUGIN_ID } from './obsidianHarness';

/**
 * Key journey of the settings tab (ticket nid_3dc4tbkt1il822ulzdmloxna1_e): change the background color and the node
 * font in Obsidian's settings -> an open map draws with them at once (its handle reports the config, the bundled font
 * loads) -> after a real restart the map still has them. What each control writes is unit-tested in `src/settings/`;
 * this only proves the Obsidian wiring (tab registered, `loadData`/`saveData`, every open map follows). Then the map's
 * gear (ticket nid_g8wymric04axnhd7lcoox7tkl_e): it opens the same rows over the map showing the tab's values, a change
 * there applies to the open map, and Escape closes the panel back to the gear. Serial: ONE
 * Obsidian for the file (relaunched once). Imports only plugin modules that do not import `obsidian`.
 */
test.describe.configure({ mode: 'serial' });

const MAP_PATH = 'Settings map.md';
const MAP_TEXT = ['---', 'organic-mindmap: 1', '---', '- Look ^root', '\t- Colors ^colors', ''].join('\n');
/** Not the default (`#2e423a`), so a stale default cannot pass. */
const NEW_BACKGROUND = '#204060';
const NEW_NODE_FONT = fontChoice('nunito');
/** Differs from both the default and `NEW_BACKGROUND`, so only the panel's write can produce it. */
const PANEL_BACKGROUND = '#304a20';

type ObsidianWindow = Window & { app: any };

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
  harness = await ObsidianHarness.launch({ extraFixtures: { [MAP_PATH]: MAP_TEXT } });
  page = harness.page;
});

test.afterAll(async () => {
  await harness?.close();
});

/** The config the open map draws with, read through the view's library handle (`null` while no map is open). */
async function openMapConfig(): Promise<{ background: string; nodeFontUrl: string; nodeFontStatus: string } | null> {
  return page.evaluate((viewType) => {
    const leaf = (window as unknown as ObsidianWindow).app.workspace.getLeavesOfType(viewType)[0];
    const handle = leaf?.view?.mapHandle;
    if (!handle) return null;
    const config = handle.getConfig();
    return { background: config.theme.color.background, nodeFontUrl: config.text.node.url, nodeFontStatus: handle.fontStatus().node };
  }, MINDMAP_VIEW_TYPE);
}

async function openPluginSettingsTab(): Promise<void> {
  await page.evaluate((pluginId) => {
    const app = (window as unknown as ObsidianWindow).app;
    app.setting.open();
    app.setting.openTabById(pluginId);
  }, PLUGIN_ID);
  await expect(page.locator('.vertical-tab-content .setting-item-name', { hasText: 'Background color' })).toBeVisible();
}

function settingRow(name: string) {
  return page.locator('.vertical-tab-content .setting-item').filter({ has: page.locator('.setting-item-name', { hasText: name }) });
}

test('a map is open with the default look', async () => {
  await harness.openFile(MAP_PATH);
  await expect.poll(openMapConfig).toMatchObject({ nodeFontUrl: fontChoice('kalam').url });
});

test('changing the background color in the settings tab applies to the open map at once', async () => {
  await openPluginSettingsTab();
  await settingRow('Background color').locator('input[type="color"]').fill(NEW_BACKGROUND);
  await expect.poll(openMapConfig).toMatchObject({ background: NEW_BACKGROUND });
});

test('choosing a bundled node font applies to the open map and the font loads from the bundle', async () => {
  await settingRow('Node font').locator('select').selectOption(NEW_NODE_FONT.id);
  await expect.poll(openMapConfig).toMatchObject({ nodeFontUrl: NEW_NODE_FONT.url, nodeFontStatus: 'loaded' });
});

test('after a real restart the map still has the chosen look', async () => {
  await page.keyboard.press('Escape');
  harness = await harness.relaunch();
  page = harness.page;
  await harness.openFile(MAP_PATH);
  await expect.poll(openMapConfig).toMatchObject({ background: NEW_BACKGROUND, nodeFontUrl: NEW_NODE_FONT.url });
});

function gearButton() {
  return page.getByRole('button', { name: MAP_SETTINGS_LABEL });
}

function settingsPanel() {
  return page.getByRole('dialog', { name: MAP_SETTINGS_LABEL });
}

test('the map gear opens the settings panel showing the values from the settings tab', async () => {
  await gearButton().click();
  await expect(settingsPanel().locator('input[type="color"]')).toHaveValue(NEW_BACKGROUND);
});

test('changing the background color in the panel applies to the open map at once', async () => {
  await settingsPanel().locator('input[type="color"]').fill(PANEL_BACKGROUND);
  await expect.poll(openMapConfig).toMatchObject({ background: PANEL_BACKGROUND });
});

test('Escape closes the panel and focus returns to the gear', async () => {
  await page.keyboard.press('Escape');
  await expect(settingsPanel()).toBeHidden();
  await expect(gearButton()).toBeFocused();
});
