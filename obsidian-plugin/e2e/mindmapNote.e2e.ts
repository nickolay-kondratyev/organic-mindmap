import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { HANDLE_GAP, HANDLE_RADIUS, LABEL_EDITOR_ACCESSIBLE_NAME, type MindmapData, type NodeBox } from 'organic-mindmap';
import { CREATE_MINDMAP_COMMAND } from '../src/commands';
import { DELETE_LABEL, UNDO_LABEL } from '../src/mapView/deleteLabels';
import { MINDMAP_FILE_SUFFIX, NEW_NOTE_ROOT_TEXT } from '../src/mapView/newNote';
import { MINDMAP_VIEW_TYPE } from '../src/mapView/viewSwitch';
import { ObsidianHarness, PLUGIN_ID } from './obsidianHarness';

/**
 * Key journeys of the mindmap note (ticket nid_lmtjqrjec483zha67vaaeydez_e): create -> the map shows the root; add a
 * child on the map -> the file contains it; rename a linked note -> the mindmap's link is updated and the map shows
 * it; drag a node, reopen the note -> the node is where it was left (ticket nid_kjtran7bnslnah9gj2fjr69rx_e); delete a
 * node from its right-click menu, then "Undo" -> the note text is back (ticket nid_48incacjmuach0kymaasz36du_e).
 * Everything else is unit-tested. Serial: ONE Obsidian for the file. Imports only plugin modules that do not
 * import `obsidian`.
 */
test.describe.configure({ mode: 'serial' });

const CREATE_COMMAND_ID = `${PLUGIN_ID}:${CREATE_MINDMAP_COMMAND.id}`;
const LINKED_NOTE_PATH = 'Linked note.md';
const RENAMED_NOTE_PATH = 'Renamed note.md';
/** A mindmap note whose name does not say so: the map opens by the frontmatter flag, not the file name. */
const LINKING_MAP_PATH = 'Project map.md';
const LINKING_MAP_TEXT = ['---', 'organic-mindmap: 1', '---', '- Project ^root', '\t- [[Linked note]] ^link1', ''].join('\n');
const POSITIONS_MAP_PATH = 'Positions map.md';
const POSITIONS_MAP_TEXT = ['---', 'organic-mindmap: 1', '---', '- Trip ^root', '\t- Packing ^pack', '\t- Route ^route', ''].join('\n');
const DRAGGED_NODE_ID = 'pack';
const DELETE_MAP_PATH = 'Delete map.md';
const DELETE_MAP_TEXT = ['---', 'organic-mindmap: 1', '---', '- Garden ^root', '\t- Weeds ^weeds', '\t- Roses ^roses', ''].join('\n');
const DELETED_NODE_ID = 'weeds';
/** Screen px to drag the node straight down; far enough to be a clear move, into empty canvas. */
const DRAG_DOWN_PX = 120;
const DRAG_STEPS = 12;
/** Scene px; saved offsets are rounded to whole pixels. */
const POSITION_TOLERANCE_PX = 2;
/** Pointer moves per node width, so the hover reaches the "+" like a real hand would. */
const POINTER_STEP_PX = 10;

/** Untyped Obsidian app globals and the plugin's view, read from inside the page. */
type ObsidianWindow = Window & { app: any };

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
  harness = await ObsidianHarness.launch({
    extraFixtures: {
      [LINKED_NOTE_PATH]: '# Linked note\n',
      [LINKING_MAP_PATH]: LINKING_MAP_TEXT,
      [POSITIONS_MAP_PATH]: POSITIONS_MAP_TEXT,
      [DELETE_MAP_PATH]: DELETE_MAP_TEXT,
    },
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

/**
 * Where the active map draws `nodeId` relative to its parent, in scene px (canvas px / zoom, so pan and zoom do not
 * matter); waits until both are painted.
 */
async function offsetFromParent(nodeId: string): Promise<{ dx: number; dy: number }> {
  const handle = await page.waitForFunction((id) => {
    const map = (window as unknown as ObsidianWindow).app.workspace.activeLeaf?.view?.mapHandle;
    const node = map?.getData().find((candidate: { id: string }) => candidate.id === id);
    const box = node === undefined ? null : map.getNodeScreenBox(id);
    const parentBox = node === undefined ? null : map.getNodeScreenBox(node.parentId);
    if (box === null || parentBox === null) return null;
    const zoom = map.getView().zoom;
    return { dx: (box.center.x - parentBox.center.x) / zoom, dy: (box.center.y - parentBox.center.y) / zoom };
  }, nodeId);
  return (await handle.jsonValue()) as { dx: number; dy: number };
}

/** The node's center in page coordinates. */
async function nodeCenterOnPage(nodeId: string): Promise<{ x: number; y: number }> {
  const box = await page.evaluate(
    (id) => (window as unknown as ObsidianWindow).app.workspace.activeLeaf?.view?.mapHandle?.getNodeScreenBox(id) ?? null,
    nodeId,
  );
  const canvas = await page.locator('.workspace-leaf.mod-active canvas').boundingBox();
  if (box === null || canvas === null) throw new Error(`Node is not painted: nodeId=[${nodeId}]`);
  return { x: canvas.x + box.center.x, y: canvas.y + box.center.y };
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

test.describe('GIVEN a node dragged to a new spot on the map', () => {
  let draggedOffset: { dx: number; dy: number };

  test.beforeAll(async () => {
    await harness.openFile(POSITIONS_MAP_PATH);
    await expect.poll(activeViewType).toBe(MINDMAP_VIEW_TYPE);
    await offsetFromParent(DRAGGED_NODE_ID);
    const from = await nodeCenterOnPage(DRAGGED_NODE_ID);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + DRAG_DOWN_PX, { steps: DRAG_STEPS });
    await page.mouse.up();
    await expect.poll(() => vaultFileText(POSITIONS_MAP_PATH)).toContain(`"${DRAGGED_NODE_ID}": {"dx"`);
    draggedOffset = await offsetFromParent(DRAGGED_NODE_ID);
  });

  test('WHEN the note is closed and opened again THEN the node is where it was left', async () => {
    await page.evaluate(() => (window as unknown as ObsidianWindow).app.workspace.activeLeaf.detach());
    await harness.openFile(POSITIONS_MAP_PATH);
    await expect.poll(activeViewType).toBe(MINDMAP_VIEW_TYPE);
    await expect
      .poll(async () => {
        const reopened = await offsetFromParent(DRAGGED_NODE_ID);
        return Math.max(Math.abs(reopened.dx - draggedOffset.dx), Math.abs(reopened.dy - draggedOffset.dy));
      })
      .toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  });
});

test.describe('GIVEN a mindmap note open as a map', () => {
  let textBeforeDelete: string | null;

  test.beforeAll(async () => {
    await harness.openFile(DELETE_MAP_PATH);
    await expect.poll(activeViewType).toBe(MINDMAP_VIEW_TYPE);
    await offsetFromParent(DELETED_NODE_ID);
    textBeforeDelete = await vaultFileText(DELETE_MAP_PATH);
  });

  test('WHEN "Delete" is chosen from a node\'s right-click menu THEN the item is gone from the file', async () => {
    const node = await nodeCenterOnPage(DELETED_NODE_ID);
    await page.mouse.click(node.x, node.y, { button: 'right' });
    await page.locator('.menu').getByText(DELETE_LABEL, { exact: true }).click();
    await expect.poll(() => vaultFileText(DELETE_MAP_PATH)).not.toContain(`^${DELETED_NODE_ID}`);
  });

  test('WHEN "Undo" is clicked on the delete notice THEN the file text equals the text before the delete', async () => {
    await page.locator('.notice').getByRole('button', { name: UNDO_LABEL }).click();
    await expect.poll(() => vaultFileText(DELETE_MAP_PATH)).toBe(textBeforeDelete);
  });
});
