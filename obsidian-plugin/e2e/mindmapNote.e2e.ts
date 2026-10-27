import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  HANDLE_GAP,
  HANDLE_RADIUS,
  LABEL_EDITOR_ACCESSIBLE_NAME,
  REPARENT_DIALOG_LABELS,
  type MindmapData,
  type NodeBox,
} from 'organic-mindmap';
import { CREATE_MINDMAP_COMMAND } from '../src/commands';
import { DELETE_LABEL, UNDO_LABEL } from '../src/mapView/deleteLabels';
import { MINDMAP_FILE_SUFFIX, NEW_NOTE_ROOT_TEXT } from '../src/mapView/newNote';
import { MARKDOWN_VIEW_TYPE, MINDMAP_VIEW_TYPE } from '../src/mapView/viewSwitch';
import { ObsidianHarness, PLUGIN_ID } from './obsidianHarness';

/**
 * Key journeys of the mindmap note (ticket nid_lmtjqrjec483zha67vaaeydez_e): create -> the map shows the root; add a
 * child on the map -> the file contains it; rename a linked note -> the mindmap's link is updated and the map shows
 * it; drag a node, reopen the note -> the node is where it was left (ticket nid_kjtran7bnslnah9gj2fjr69rx_e); delete a
 * node from its right-click menu, then "Undo" -> the note text is back (ticket nid_48incacjmuach0kymaasz36du_e);
 * drag a node with a child onto another node and confirm "Make child" -> the branch is nested there in the note, and
 * deleting a node removes its child too (ticket nid_0v1xv98rj4u0fertn6uxlhbeg_e); click a link node -> a plain note opens
 * as Markdown, a mindmap note as a map, and going back returns to the map (ticket nid_fai5tp8qj4o6vpf0gmjj6h8rg_e);
 * add a child, Ctrl+Z -> the child is gone from the file, Ctrl+Shift+Z -> it is back
 * (ticket nid_x9jc2ml9mws9tn4l013zuc68r_e).
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
const DELETE_MAP_TEXT = ['---', 'organic-mindmap: 1', '---', '- Garden ^root', '\t- Weeds ^weeds', '\t\t- Dandelion ^dandelion', '\t- Roses ^roses', ''].join('\n');
const DELETED_NODE_ID = 'weeds';
const FIRST_CHILD_TEXT = 'First idea';
const GRANDCHILD_TEXT = 'A detail';
const DELETED_CHILD_ID = 'dandelion';
const MOVE_MAP_PATH = 'Move map.md';
const MOVE_MAP_TEXT = ['---', 'organic-mindmap: 1', '---', '- Kitchen ^root', '\t- Pantry ^pantry', '\t\t- Spices ^spices', '\t- Cellar ^cellar', ''].join('\n');
const MOVED_NODE_ID = 'pantry';
const LINKS_MAP_PATH = 'Links map.md';
const PLAIN_NOTE_PATH = 'Plain note.md';
const LINKED_MAP_PATH = 'Linked map.md';
const PLAIN_LINK_NODE_ID = 'plainlink';
const MAP_LINK_NODE_ID = 'maplink';
const LINKS_MAP_TEXT = [
  '---',
  'organic-mindmap: 1',
  '---',
  '- Reading ^root',
  `\t- [[Plain note]] ^${PLAIN_LINK_NODE_ID}`,
  `\t- [[Linked map]] ^${MAP_LINK_NODE_ID}`,
  '',
].join('\n');
const LINKED_MAP_TEXT = ['---', 'organic-mindmap: 1', '---', '- Linked map root ^root', ''].join('\n');
/** Obsidian's built-in "Navigate back" command. */
const GO_BACK_COMMAND_ID = 'app:go-back';
const NEW_PARENT_ID = 'cellar';
/** The moved branch as the note should hold it: last child of the new parent, every level re-indented, ids kept. */
const MOVED_BRANCH_LINES = '\t- Cellar ^cellar\n\t\t- Pantry ^pantry\n\t\t\t- Spices ^spices\n';
const UNDO_MAP_PATH = 'Undo map.md';
const UNDO_MAP_TEXT = ['---', 'organic-mindmap: 1', '---', '- Lab ^root', '\t- Bench ^bench', ''].join('\n');
const UNDONE_CHILD_TEXT = 'Microscope';
/** Obsidian's Mod is Control on Linux, where the E2E runs. */
const UNDO_SHORTCUT = 'Control+z';
const REDO_SHORTCUT = 'Control+Shift+z';
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
      [MOVE_MAP_PATH]: MOVE_MAP_TEXT,
      [LINKS_MAP_PATH]: LINKS_MAP_TEXT,
      [PLAIN_NOTE_PATH]: '# Plain note\n\nJust text.\n',
      [LINKED_MAP_PATH]: LINKED_MAP_TEXT,
      [UNDO_MAP_PATH]: UNDO_MAP_TEXT,
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

/**
 * A node's box in page coordinates and its outer side (the root: right; others: the side of the root they lie on),
 * waiting until the map has painted it.
 */
async function nodeBoxOnPage(nodeId: string): Promise<{ box: NodeBox; zoom: number; side: 'left' | 'right' }> {
  const handle = await page.waitForFunction((id) => {
    const map = (window as unknown as ObsidianWindow).app.workspace.activeLeaf?.view?.mapHandle;
    const root = map?.getData().find((node: { parentId: string | null }) => node.parentId === null);
    const box = root === undefined ? null : map.getNodeScreenBox(id);
    const rootBox = root === undefined ? null : map.getNodeScreenBox(root.id);
    if (box === null || rootBox === null) return null;
    return { box, zoom: map.getView().zoom, side: box.center.x < rootBox.center.x ? 'left' : 'right' };
  }, nodeId);
  const { box, zoom, side } = (await handle.jsonValue()) as { box: NodeBox; zoom: number; side: 'left' | 'right' };
  const canvas = await page.locator('.workspace-leaf.mod-active canvas').boundingBox();
  if (canvas === null) throw new Error('The active map canvas is not visible');
  return { box: { center: { x: canvas.x + box.center.x, y: canvas.y + box.center.y }, size: box.size }, zoom, side };
}

/** Waits until the active map has painted its root. */
async function rootPainted(): Promise<void> {
  await page.waitForFunction(() => {
    const map = (window as unknown as ObsidianWindow).app.workspace.activeLeaf?.view?.mapHandle;
    const root = map?.getData().find((node: { parentId: string | null }) => node.parentId === null);
    return root !== undefined && map.getNodeScreenBox(root.id) !== null;
  });
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

/**
 * WHY: the map is drawn for the size given to `resize`; when that is not the canvas's own CSS box the bitmap is
 * scaled into the box and nothing drawn lines up with where clicks are hit-tested (the "+" a person sees is not
 * where the "+" is). The journeys below click computed positions, so only this invariant catches that.
 */
test('WHEN a map is shown THEN its canvas bitmap is exactly its CSS box times the device pixel ratio', async () => {
  await rootPainted();
  // One string each, so a mismatch prints both sizes side by side.
  const sizes = await page.evaluate(() => {
    const canvas = document.querySelector('.workspace-leaf.mod-active canvas') as HTMLCanvasElement;
    const cssBox = `${Math.round(canvas.clientWidth * window.devicePixelRatio)}x${Math.round(canvas.clientHeight * window.devicePixelRatio)}`;
    return { bitmap: `${canvas.width}x${canvas.height}`, cssBox };
  });
  expect(sizes.bitmap).toBe(sizes.cssBox);
});

/** The way a person adds: hover the node, click its "+", type (the input took focus), Enter. */
async function addChildViaPlus(nodeId: string, label: string): Promise<void> {
  const { box, zoom, side } = await nodeBoxOnPage(nodeId);
  // Every node shows a "+" on both sides; take the outer one (the root: right).
  const outward = side === 'left' ? -1 : 1;
  const plus = { x: box.center.x + outward * (box.size.width / 2 + (HANDLE_GAP + HANDLE_RADIUS) * zoom), y: box.center.y };
  await page.mouse.move(box.center.x, box.center.y);
  await page.mouse.move(plus.x, plus.y, { steps: Math.ceil(Math.abs(plus.x - box.center.x) / POINTER_STEP_PX) });
  await page.mouse.click(plus.x, plus.y);
  await expect(page.getByRole('textbox', { name: LABEL_EDITOR_ACCESSIBLE_NAME })).toBeFocused();
  await page.keyboard.type(label);
  await page.keyboard.press('Enter');
}

test('WHEN a child is added on the map via the root\'s "+" THEN the note text and the map contain it', async () => {
  const mapPath = await activeFilePath();
  if (mapPath === null) throw new Error('No active mindmap note');
  const rootId = (await activeMapData())?.find((node) => node.parentId === null)?.id;
  if (rootId === undefined) throw new Error('No root on the active map');
  await addChildViaPlus(rootId, FIRST_CHILD_TEXT);
  await expect.poll(() => vaultFileText(mapPath)).toContain(`\t- ${FIRST_CHILD_TEXT} ^`);
  await expect.poll(async () => (await activeMapData())?.map((node) => node.text)).toContain(FIRST_CHILD_TEXT);
});

test('WHEN a grandchild is added via the new child\'s "+" THEN the note text nests it under the child and the map shows it', async () => {
  const mapPath = await activeFilePath();
  if (mapPath === null) throw new Error('No active mindmap note');
  const childId = (await activeMapData())?.find((node) => node.text === FIRST_CHILD_TEXT)?.id;
  if (childId === undefined) throw new Error('The first child is not on the map');
  await addChildViaPlus(childId, GRANDCHILD_TEXT);
  await expect.poll(() => vaultFileText(mapPath)).toContain(`\t\t- ${GRANDCHILD_TEXT} ^`);
  await expect.poll(async () => (await activeMapData())?.find((node) => node.text === GRANDCHILD_TEXT)?.parentId).toBe(childId);
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

  test('WHEN "Delete" is chosen from a node\'s right-click menu THEN the item and its child are gone from the file', async () => {
    const node = await nodeCenterOnPage(DELETED_NODE_ID);
    await page.mouse.click(node.x, node.y, { button: 'right' });
    await page.locator('.menu').getByText(DELETE_LABEL, { exact: true }).click();
    await expect
      .poll(async () => {
        const text = (await vaultFileText(DELETE_MAP_PATH)) ?? '';
        return [DELETED_NODE_ID, DELETED_CHILD_ID].filter((id) => text.includes(`^${id}`));
      })
      .toEqual([]);
  });

  test('WHEN "Undo" is clicked on the delete notice THEN the file text equals the text before the delete', async () => {
    await page.locator('.notice').getByRole('button', { name: UNDO_LABEL }).click();
    await expect.poll(() => vaultFileText(DELETE_MAP_PATH)).toBe(textBeforeDelete);
  });
});

test.describe('GIVEN a node with a child dragged onto another node', () => {
  test.beforeAll(async () => {
    await harness.openFile(MOVE_MAP_PATH);
    await expect.poll(activeViewType).toBe(MINDMAP_VIEW_TYPE);
    await offsetFromParent(MOVED_NODE_ID);
    const from = await nodeCenterOnPage(MOVED_NODE_ID);
    const onto = await nodeCenterOnPage(NEW_PARENT_ID);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(onto.x, onto.y, { steps: DRAG_STEPS });
    await page.mouse.up();
  });

  test('WHEN "Make child" is confirmed THEN the note holds the node and its child nested under the new parent', async () => {
    await page
      .locator('.workspace-leaf.mod-active')
      .getByRole('dialog')
      .getByRole('button', { name: REPARENT_DIALOG_LABELS.confirm })
      .click();
    await expect.poll(() => vaultFileText(MOVE_MAP_PATH)).toContain(MOVED_BRANCH_LINES);
  });

  test('WHEN the move is written THEN the map shows the node under its new parent', async () => {
    await expect.poll(async () => (await activeMapData())?.find((node) => node.id === MOVED_NODE_ID)?.parentId).toBe(NEW_PARENT_ID);
  });
});

/** The active leaf's view type and file, as one value so a mismatch prints both. */
async function activeViewAndFile(): Promise<{ type: string | null; path: string | null }> {
  return { type: await activeViewType(), path: await activeFilePath() };
}

/** A plain left click on a node once painted, the way a person opens its link. */
async function clickNode(nodeId: string): Promise<void> {
  const { box } = await nodeBoxOnPage(nodeId);
  await page.mouse.click(box.center.x, box.center.y);
}

test.describe('GIVEN a map with link nodes to a plain note and to a mindmap note, open as a map', () => {
  test.beforeEach(async () => {
    await harness.openFile(LINKS_MAP_PATH);
    await expect.poll(activeViewAndFile).toEqual({ type: MINDMAP_VIEW_TYPE, path: LINKS_MAP_PATH });
  });

  test('WHEN the plain note\'s link node is clicked THEN the plain note opens as Markdown', async () => {
    await clickNode(PLAIN_LINK_NODE_ID);
    await expect.poll(activeViewAndFile).toEqual({ type: MARKDOWN_VIEW_TYPE, path: PLAIN_NOTE_PATH });
  });

  test('WHEN back navigation runs after opening the plain note from the map THEN the map shows again', async () => {
    await clickNode(PLAIN_LINK_NODE_ID);
    await expect.poll(activeViewAndFile).toEqual({ type: MARKDOWN_VIEW_TYPE, path: PLAIN_NOTE_PATH });
    await harness.runCommand(GO_BACK_COMMAND_ID);
    await expect.poll(activeViewAndFile).toEqual({ type: MINDMAP_VIEW_TYPE, path: LINKS_MAP_PATH });
  });

  test('WHEN the mindmap note\'s link node is clicked THEN that note opens as a map', async () => {
    await clickNode(MAP_LINK_NODE_ID);
    await expect.poll(activeViewAndFile).toEqual({ type: MINDMAP_VIEW_TYPE, path: LINKED_MAP_PATH });
  });

  test('WHEN a plain note is opened in the map\'s leaf another way (as the file explorer does) THEN it opens as Markdown', async () => {
    await harness.openFile(PLAIN_NOTE_PATH);
    await expect.poll(activeViewAndFile).toEqual({ type: MARKDOWN_VIEW_TYPE, path: PLAIN_NOTE_PATH });
  });
});

test.describe('GIVEN a child added on the map', () => {
  test.beforeAll(async () => {
    await harness.openFile(UNDO_MAP_PATH);
    await expect.poll(activeViewType).toBe(MINDMAP_VIEW_TYPE);
    await addChildViaPlus('root', UNDONE_CHILD_TEXT);
    // The map shows the child once the view has the written note; the undo keys may come at any time after the add
    // (an undo queues behind the add's write), so this wait is only for the map state the later test reads.
    await expect.poll(async () => (await activeMapData())?.map((node) => node.text)).toContain(UNDONE_CHILD_TEXT);
  });

  test('WHEN Ctrl+Z is pressed THEN the file text is back to what it was before the add', async () => {
    await page.keyboard.press(UNDO_SHORTCUT);
    await expect.poll(() => vaultFileText(UNDO_MAP_PATH)).toBe(UNDO_MAP_TEXT);
  });

  test('WHEN Ctrl+Shift+Z is pressed after the undo THEN the file holds the child again', async () => {
    await page.keyboard.press(REDO_SHORTCUT);
    await expect.poll(() => vaultFileText(UNDO_MAP_PATH)).toContain(UNDONE_CHILD_TEXT);
  });

  test('WHEN the map was undone and redone THEN the map shows the child', async () => {
    await expect.poll(async () => (await activeMapData())?.map((node) => node.text)).toContain(UNDONE_CHILD_TEXT);
  });
});
