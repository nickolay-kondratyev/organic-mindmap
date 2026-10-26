import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { HANDLE_GAP, HANDLE_RADIUS, LABEL_EDITOR_ACCESSIBLE_NAME, type MindmapData, type NodeBox } from 'organic-mindmap';
import { CREATE_MINDMAP_COMMAND } from '../src/commands';
import { MINDMAP_FILE_SUFFIX, NEW_NOTE_ROOT_TEXT } from '../src/mapView/newNote';
import { MINDMAP_VIEW_TYPE } from '../src/mapView/viewSwitch';
import { ObsidianHarness, PLUGIN_ID } from './obsidianHarness';

/**
 * Key journeys of the mindmap note (ticket nid_lmtjqrjec483zha67vaaeydez_e): create -> the map shows the root; add a
 * child on the map -> the file contains it; rename a linked note -> the mindmap's link is updated and the map shows
 * it. Everything else is unit-tested. Serial: ONE Obsidian for the file. Imports only plugin modules that do not
 * import `obsidian`.
 */
test.describe.configure({ mode: 'serial' });

const CREATE_COMMAND_ID = `${PLUGIN_ID}:${CREATE_MINDMAP_COMMAND.id}`;
const LINKED_NOTE_PATH = 'Linked note.md';
const RENAMED_NOTE_PATH = 'Renamed note.md';
/** A mindmap note whose name does not say so: the map opens by the frontmatter flag, not the file name. */
const LINKING_MAP_PATH = 'Project map.md';
const LINKING_MAP_TEXT = ['---', 'organic-mindmap: 1', '---', '- Project ^root', '\t- [[Linked note]] ^link1', ''].join('\n');
/** Pointer moves per node width, so the hover reaches the "+" like a real hand would. */
const POINTER_STEP_PX = 10;

/** Untyped Obsidian app globals and the plugin's view, read from inside the page. */
type ObsidianWindow = Window & { app: any };

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
  harness = await ObsidianHarness.launch({
    extraFixtures: { [LINKED_NOTE_PATH]: '# Linked note\n', [LINKING_MAP_PATH]: LINKING_MAP_TEXT },
  });
  page = harness.page;
});

test.afterAll(async () => {
  await harness?.close();
});

async function activeViewType(): Promise<string | null> {
  return page.evaluate(() => (window as unknown as ObsidianWindow).app.workspace.activeLeaf?.view?.getViewType() ?? null);
}

async function activeFilePath(): Promise<string | null> {
  return page.evaluate(() => (window as unknown as ObsidianWindow).app.workspace.getActiveFile()?.path ?? null);
}

/** What the active map draws (through the view's library handle); `null` while no map is active. */
async function activeMapData(): Promise<MindmapData | null> {
  return page.evaluate(() => (window as unknown as ObsidianWindow).app.workspace.activeLeaf?.view?.mapHandle?.getData() ?? null);
}

async function vaultFileText(vaultPath: string): Promise<string | null> {
  return page.evaluate(async (targetPath) => {
    const app = (window as unknown as ObsidianWindow).app;
    const file = app.vault.getFileByPath(targetPath);
    return file === null ? null : app.vault.read(file);
  }, vaultPath);
}

/** The root node's box in page coordinates, waiting until the map has painted it. */
async function rootNodeBox(): Promise<{ box: NodeBox; zoom: number }> {
  const handle = await page.waitForFunction(() => {
    const view = (window as unknown as ObsidianWindow).app.workspace.activeLeaf?.view;
    const root = view?.mapHandle?.getData().find((node: { parentId: string | null }) => node.parentId === null);
    const box = root === undefined ? null : view.mapHandle.getNodeScreenBox(root.id);
    return box === null ? null : { box, zoom: view.mapHandle.getView().zoom };
  });
  const { box, zoom } = (await handle.jsonValue()) as { box: NodeBox; zoom: number };
  const canvas = await page.locator('.workspace-leaf.mod-active canvas').boundingBox();
  if (canvas === null) throw new Error('The active map canvas is not visible');
  return { box: { center: { x: canvas.x + box.center.x, y: canvas.y + box.center.y }, size: box.size }, zoom };
}

test('WHEN "Create new mindmap" runs THEN a mindmap note opens as a map showing its root', async () => {
  await harness.runCommand(CREATE_COMMAND_ID);
  await expect.poll(activeViewType).toBe(MINDMAP_VIEW_TYPE);
  expect(await activeFilePath()).toMatch(new RegExp(`^Mindmap .*${MINDMAP_FILE_SUFFIX.replaceAll('.', '\\.')}$`));
  await expect.poll(async () => (await activeMapData())?.map((node) => node.text)).toEqual([NEW_NOTE_ROOT_TEXT]);
});

test('WHEN a child is added on the map via the root\'s "+" THEN the note text contains it', async () => {
  const mapPath = await activeFilePath();
  if (mapPath === null) throw new Error('No active mindmap note');
  const { box: root, zoom } = await rootNodeBox();
  // The root shows a "+" on both sides; take the right one.
  const plus = { x: root.center.x + root.size.width / 2 + (HANDLE_GAP + HANDLE_RADIUS) * zoom, y: root.center.y };
  await page.mouse.move(root.center.x, root.center.y);
  await page.mouse.move(plus.x, plus.y, { steps: Math.ceil((plus.x - root.center.x) / POINTER_STEP_PX) });
  await page.mouse.click(plus.x, plus.y);
  await page.getByRole('textbox', { name: LABEL_EDITOR_ACCESSIBLE_NAME }).fill('First idea');
  await page.keyboard.press('Enter');
  await expect.poll(() => vaultFileText(mapPath)).toContain('\t- First idea ^');
});

test.describe('GIVEN a mindmap note linking to another note, open as a map', () => {
  test.beforeAll(async () => {
    await harness.openFile(LINKING_MAP_PATH);
    await expect.poll(activeViewType).toBe(MINDMAP_VIEW_TYPE);
    // Obsidian rewrites links from its link index; wait until the mindmap note's link is indexed.
    await expect
      .poll(() =>
        page.evaluate(
          ([source, target]) => Boolean((window as unknown as ObsidianWindow).app.metadataCache.resolvedLinks[source!]?.[target!]),
          [LINKING_MAP_PATH, LINKED_NOTE_PATH],
        ),
      )
      .toBe(true);
  });

  test('WHEN the linked note is renamed THEN the mindmap note\'s link is updated and the map shows the new name', async () => {
    await page.evaluate(
      async ([from, to]) => {
        const app = (window as unknown as ObsidianWindow).app;
        await app.fileManager.renameFile(app.vault.getFileByPath(from), to);
      },
      [LINKED_NOTE_PATH, RENAMED_NOTE_PATH],
    );
    await expect.poll(() => vaultFileText(LINKING_MAP_PATH)).toContain('[[Renamed note]] ^link1');
    await expect.poll(async () => (await activeMapData())?.find((node) => node.id === 'link1')?.text).toBe('Renamed note');
  });
});
