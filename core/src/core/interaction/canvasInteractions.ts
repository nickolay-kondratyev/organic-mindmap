import type { BranchConfig, MindmapConfig } from '../config/config';
import type { EditRequest } from '../edit/editRequest';
import { PENDING_NODE_ID, type EditSession, type EditStatus } from '../edit/editSession';
import type { MindmapExtensions } from '../extensions';
import { buildBranches } from '../geometry/branchGeometry';
import { subtreeIds } from '../layout/layoutLookups';
import {
  moveSubtree,
  nodeOffsetsOf,
  overridesFromNodeOffsets,
  subtreeMoveBy,
  type NodeOffsets,
} from '../layout/positionOverrides';
import type { NodeId, Point, Side } from '../model/node';
import { buildTree, type MindmapTree } from '../model/tree';
import type { Viewport } from '../render/canvasRenderer';
import { drawInteractionOverlay } from '../render/interactionOverlay';
import { nodeLabelInk } from '../render/labelRenderer';
import type { Scene } from '../render/scene';
import { cachedSceneBuilder } from '../render/sceneCache';
import type { NodeBox } from '../shape/nodeShape';
import type { LabelFonts } from '../text/labelFontLoader';
import type { LoadedFont } from '../text/loadedFont';
import type { ViewController } from '../view/viewController';
import { editorAllowed, shownHandles } from './editAffordances';
import { nodeAt, nodeBoxOf, pointerTargetAt, sameHandle, type NodeHandle, type PointerTarget } from './hitTest';
import { InlineLabelEditor, type LabelEditorPlacement } from './inlineLabelEditor';
import { addDraftRequest, DRAFT_NODE_ID, isTransient, LocalEditState } from './localEditState';
import { NoticeBanner } from './noticeBanner';
import { nodeClickEvent, type ModifierKeys, type NodeClickEvent } from './nodeClickEvent';
import { contextMenuNodeId, type NodeContextMenuEvent } from './nodeContextMenuEvent';
import { clickedNodeId, PointerGesture, type PressTarget } from './pointerGesture';
import { ReparentConfirmation } from './reparentConfirmation';
import { ReparentDialog } from './reparentDialog';
import type { NodeRepositionEvent } from './repositionEvent';

/** What the interactions need from the mount; getters because config/extensions/fonts change over time. */
export interface InteractionHost {
  readonly canvas: HTMLCanvasElement;
  readonly edits: EditSession;
  readonly view: ViewController;
  config(): MindmapConfig;
  extensions(): MindmapExtensions;
  fonts(): LabelFonts;
  /** CSS `font-family` for DOM text in `font` (the inline editor); see `CssFontFaces`. */
  cssFontFamily(font: LoadedFont | null): string;
  requestRepaint(): void;
  onNodeReposition(event: NodeRepositionEvent): void;
  /** Every user-placed node after a change the user made (a drop, a confirmed reparent); see `setNodeOffsets`. */
  onNodeOffsetsChange(offsets: NodeOffsets): void;
  onNodeClick(event: NodeClickEvent): void;
  /** Set means the host shows its own menu, so a right-click on a node suppresses the browser's. */
  readonly onNodeContextMenu?: (event: NodeContextMenuEvent) => void;
  /** The user changed a setting from inside the map (e.g. "Don't ask again"); the mount applies and reports it. */
  changeConfig(config: MindmapConfig): void;
}

/** A node drag in progress (spec I2/I3). */
interface NodeDrag {
  readonly nodeId: NodeId;
  /** Scene at drag start; the drag preview moves the subtree within it. */
  readonly base: Scene;
  /** `base.tree` with the dragged subtree painted last, i.e. on top. */
  readonly paintTree: MindmapTree;
  /** The dragged subtree plus transient nodes: never drop targets. */
  readonly excludedIds: ReadonlySet<NodeId>;
  /** Scene-unit offset of the dragged subtree. */
  readonly offset: Point;
  readonly dropTargetId: NodeId | null;
}

const PRIMARY_BUTTON = 0;
const CANVAS_PRESS: PressTarget = { kind: 'canvas' };
/** Share of the node width the inline editor uses; matches the room node labels get inside the shape. */
const EDITOR_WIDTH_FRACTION = 0.8;
const CURSOR = { idle: '', grab: 'grab', grabbing: 'grabbing', button: 'pointer', busy: 'progress' } as const;

/**
 * Canvas pointer interactions (spec I1-I5, I11): pan/zoom, drag to reposition (push-apart on drop) or to reparent
 * (drop onto a node, after a confirmation the user can turn off), hover "+" button, double-click inline rename (both
 * can be switched off in config), node clicks reported via `onNodeClick`, node right-clicks via `onNodeContextMenu`,
 * the host's highlight, plus the pending / rejected feedback.
 * Structural edits only ever go through `EditSession` (the host confirms); repositions are library-local
 * overrides reported via `onNodeReposition` and `onNodeOffsetsChange`. This class is the DOM wiring; the decisions
 * live in DOM-free units (`PointerGesture`, `hitTest`, `LocalEditState`, `ReparentConfirmation`).
 *
 * WHY-NOT live push-apart while dragging: the drop target would always be pushed out from under the pointer,
 * making reparenting impossible. Other nodes stay put during the drag and yield once it is dropped.
 */
export class CanvasInteractions {
  private readonly gesture = new PointerGesture();
  private readonly local: LocalEditState;
  private readonly editor: InlineLabelEditor;
  private readonly notice: NoticeBanner;
  private readonly reparent: ReparentConfirmation;
  private readonly reparentDialog: ReparentDialog;
  private readonly removeListeners: (() => void)[] = [];
  /** Last painted scene: what the user sees, so it is what pointer events hit-test against. */
  private painted: Scene | null = null;
  private readonly buildScene = cachedSceneBuilder();
  private hoveredNodeId: NodeId | null = null;
  private hoveredHandle: NodeHandle | null = null;
  /** Set by the host (`setHighlightedNode`); painted as an overlay, so it never rebuilds the scene. */
  private highlightedNodeId: NodeId | null = null;
  private drag: NodeDrag | null = null;
  /** A drop onto a node waiting for the user's answer (spec I3); painted frozen at the drop meanwhile. */
  private askedDrop: NodeDrag | null = null;
  /** Node the inline editor sits on (`DRAFT_NODE_ID` while adding). */
  private editorNodeId: NodeId | null = null;

  constructor(private readonly host: InteractionHost) {
    const { canvas } = host;
    this.editor = new InlineLabelEditor(canvas);
    this.notice = new NoticeBanner(canvas, () => host.edits.clearRejection());
    this.local = new LocalEditState(host.edits, (overrides) => host.onNodeOffsetsChange(nodeOffsetsOf(overrides)));
    this.reparentDialog = new ReparentDialog(canvas);
    this.reparent = new ReparentConfirmation({
      config: () => host.config(),
      changeConfig: (config) => host.changeConfig(config),
      send: (request) => this.submit(request),
    });
    this.listen('pointerdown', (event) => this.onPointerDown(event));
    this.listen('pointermove', (event) => this.onPointerMove(event));
    this.listen('pointerup', (event) => this.onPointerUp(event));
    this.listen('pointercancel', () => this.cancelGesture());
    this.listen('lostpointercapture', () => this.cancelGesture());
    this.listen('pointerleave', () => this.setHover(null, null));
    this.listen('dblclick', (event) => this.onDoubleClick(event));
    this.listen('contextmenu', (event) => this.onContextMenu(event));
    // Not passive: the page must not scroll while the wheel zooms the map.
    this.listen('wheel', (event) => this.onWheel(event), { passive: false });
  }

  /**
   * The scene to paint now. Rebuilt only when data, config, extensions or position overrides are new objects
   * (`cachedSceneBuilder`); hover, pan, zoom and the busy animation reuse the last scene. Ceiling: the drag
   * preview re-routes every branch on each pointer move (over a frozen base scene), fine up to ~1,000 nodes.
   */
  sceneToPaint(): Scene {
    const config = this.host.config();
    const drag = this.shownDrag();
    this.painted =
      drag === null
        ? this.buildScene(this.local.displayData(), config, this.host.extensions(), this.local.effectiveOverrides())
        : draggedScene(drag, config.branch);
    return this.painted;
  }

  /** Paints hover buttons, drop highlight and pending state over `scene`, and keeps DOM overlays in place. */
  paintOverlay(ctx: CanvasRenderingContext2D, scene: Scene, viewport: Viewport): void {
    const pendingNodeId = this.host.edits.preview?.nodeId ?? null;
    drawInteractionOverlay(ctx, scene, this.host.config(), this.host.extensions(), viewport, this.host.view.view, {
      handles: this.visibleHandles(scene),
      hoveredHandle: this.hoveredHandle,
      highlightedNodeId: this.highlightedNodeId,
      dropTargetId: this.shownDrag()?.dropTargetId ?? null,
      pendingNodeId,
      timeMs: performance.now(),
    });
    this.editor.place(this.editorNodeId === null ? null : this.editorPlacement(scene, this.editorNodeId));
    this.notice.place();
    this.reparentDialog.place();
    // Keeps the busy ring moving until the host answers.
    if (pendingNodeId !== null) this.host.requestRepaint();
  }

  /** Replaces the user-placed nodes (offsets from their parents, e.g. saved earlier); unknown ids are ignored. */
  setNodeOffsets(offsets: NodeOffsets): void {
    this.local.setOverrides(overridesFromNodeOffsets(offsets));
    this.host.requestRepaint();
  }

  /** An unknown id simply paints no ring (e.g. the host's node is not in the data yet). */
  setHighlightedNode(nodeId: NodeId | null): void {
    if (nodeId === this.highlightedNodeId) return;
    this.highlightedNodeId = nodeId;
    this.host.requestRepaint();
  }

  onEditStatusChange(status: EditStatus): void {
    const retry = this.local.onEditStatusChange(status);
    if (status.kind === 'rejected') this.notice.show(status.reason);
    else this.notice.hide();
    if (retry !== null) this.reopenForRetry(retry);
    this.updateCursor();
  }

  /** Node box in canvas CSS px as last painted, e.g. for hosts placing their own DOM next to a node. */
  nodeScreenBox(nodeId: NodeId): NodeBox | null {
    const box = this.painted === null ? null : nodeBoxOf(this.painted, nodeId);
    if (box === null) return null;
    const { view } = this.host;
    const { zoom } = view.view;
    return { center: view.sceneToScreen(box.center), size: { width: box.size.width * zoom, height: box.size.height * zoom } };
  }

  dispose(): void {
    for (const remove of this.removeListeners) remove();
    this.editor.dispose();
    this.notice.dispose();
    this.reparentDialog.dispose();
  }

  // ---- pointer events ----

  private onPointerDown(event: PointerEvent): void {
    // While a drop is being asked about, the map waits for the answer instead of starting another gesture.
    if (event.button !== PRIMARY_BUTTON || this.painted === null || this.askedDrop !== null) return;
    const screen = this.canvasPoint(event);
    this.gesture.press(screen, this.pressTargetAt(this.painted, screen));
    this.host.canvas.setPointerCapture(event.pointerId);
  }

  private onPointerMove(event: PointerEvent): void {
    const screen = this.canvasPoint(event);
    const step = this.gesture.move(screen);
    switch (step.kind) {
      case 'none':
        this.updateHover(screen);
        return;
      case 'pan':
        this.host.canvas.style.cursor = CURSOR.grabbing;
        this.host.view.panBy(step.delta);
        return;
      case 'drag':
        this.updateDrag(step.nodeId, step.offset, screen);
        return;
    }
  }

  private onPointerUp(event: PointerEvent): void {
    const screen = this.canvasPoint(event);
    // No explicit releasePointerCapture: the browser releases it right after pointerup, and an explicit release
    // here would fire lostpointercapture (which cancels the gesture) around the drop being handled.
    const end = this.gesture.release(screen);
    switch (end.kind) {
      case 'none':
        break;
      case 'click':
        this.onClick(end.target, event);
        break;
      case 'drag-end':
        this.finishDrag(end.offset);
        break;
    }
    this.updateHover(screen);
  }

  private onDoubleClick(event: MouseEvent): void {
    if (this.painted === null || this.askedDrop !== null) return;
    const nodeId = nodeAt(this.painted, this.host.view.screenToScene(this.canvasPoint(event)), this.host.extensions().nodeShape);
    if (nodeId !== null && !isTransient(nodeId)) this.openRename(nodeId);
  }

  /** Only a right-click on a real node goes to the host's hook; anything else keeps the browser's own menu. */
  private onContextMenu(event: MouseEvent): void {
    const report = this.host.onNodeContextMenu;
    if (report === undefined || this.painted === null || this.askedDrop !== null) return;
    const scenePoint = this.host.view.screenToScene(this.canvasPoint(event));
    const nodeId = contextMenuNodeId(this.painted, scenePoint, this.host.extensions().nodeShape);
    if (nodeId === null) return;
    event.preventDefault();
    report({ nodeId, clientPoint: { x: event.clientX, y: event.clientY } });
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.host.view.zoomByWheel(this.canvasPoint(event), event.deltaY);
  }

  private cancelGesture(): void {
    this.gesture.cancel();
    if (this.drag === null) return;
    this.drag = null;
    this.host.requestRepaint();
  }

  /** Reported at once, even as the first half of a double-click (see `clickedNodeId`). */
  private onClick(target: PressTarget, keys: ModifierKeys): void {
    const nodeId = clickedNodeId(target);
    if (nodeId !== null) this.host.onNodeClick(nodeClickEvent(nodeId, keys));
    if (target.kind !== 'handle') return;
    const { handle } = target;
    this.openAddDraft(handle.nodeId, handle.side, '');
  }

  // ---- drag ----

  private updateDrag(nodeId: NodeId, screenOffset: Point, screen: Point): void {
    const drag = this.drag ?? this.startDrag(nodeId);
    if (drag === null) return;
    const scenePoint = this.host.view.screenToScene(screen);
    this.drag = {
      ...drag,
      offset: this.toSceneOffset(screenOffset),
      dropTargetId: nodeAt(drag.base, scenePoint, this.host.extensions().nodeShape, drag.excludedIds),
    };
    this.host.canvas.style.cursor = CURSOR.grabbing;
    this.host.requestRepaint();
  }

  private startDrag(nodeId: NodeId): NodeDrag | null {
    const base = this.painted;
    if (base === null) return null;
    this.setHover(null, null);
    const movedIds = new Set(subtreeIds(base.tree, nodeId));
    const excludedIds = new Set([...movedIds, PENDING_NODE_ID, DRAFT_NODE_ID]);
    const paintTree = treeWithSubtreeOnTop(base.tree, movedIds);
    return { nodeId, base, paintTree, excludedIds, offset: { x: 0, y: 0 }, dropTargetId: null };
  }

  /** Drop onto a node reparents through the host (spec I3); anywhere else is a reposition (spec I2). */
  private finishDrag(screenOffset: Point): void {
    const drag = this.drag;
    this.drag = null;
    if (drag === null) return;
    this.host.requestRepaint();
    if (drag.dropTargetId !== null) {
      this.dropOnto(drag, drag.dropTargetId);
      return;
    }
    const reposition = this.local.dropAway(drag.base, drag.nodeId, this.toSceneOffset(screenOffset));
    if (reposition !== null) this.host.onNodeReposition(reposition);
  }

  /** Reparents, after asking unless the user turned that off. Answering clears the frozen drop either way. */
  private dropOnto(drag: NodeDrag, newParentId: NodeId): void {
    const question = this.reparent.drop({ type: 'move', nodeId: drag.nodeId, newParentId }, this.host.edits.confirmedData);
    if (question === null) return;
    this.askedDrop = drag;
    this.reparentDialog.open({
      text: question.text,
      onConfirm: (answer) => this.endAskedDrop(() => this.reparent.confirm(answer)),
      onCancel: () => this.endAskedDrop(() => this.reparent.cancel()),
    });
    this.updateCursor();
  }

  private endAskedDrop(answer: () => void): void {
    this.askedDrop = null;
    this.host.requestRepaint();
    answer();
    this.updateCursor();
  }

  // ---- inline editing ----

  private openRename(nodeId: NodeId, typed?: string): void {
    if (!editorAllowed(this.host.config().interaction, 'rename') || this.refusedWhilePending()) return;
    const node = this.host.edits.confirmedData.find((candidate) => candidate.id === nodeId);
    if (node === undefined) return;
    this.openEditor(nodeId, typed ?? node.text, (text) => {
      if (text !== '' && text !== node.text) this.submitFromEditor({ type: 'rename', nodeId, text });
    });
  }

  /** `side` only matters for children of the root (spec R19). */
  private openAddDraft(parentId: NodeId, side: Side | undefined, typed: string): void {
    if (!editorAllowed(this.host.config().interaction, 'add') || this.refusedWhilePending()) return;
    const draft = addDraftRequest(this.host.edits.confirmedData, parentId, side);
    if (draft === null) return;
    this.openEditor(DRAFT_NODE_ID, typed, (text) => {
      if (text !== '') this.submitFromEditor({ ...draft, text });
    });
    // After `openEditor`, which clears any previous draft.
    this.local.showDraft(draft);
  }

  /** `commit` gets the trimmed label after the editor has closed. */
  private openEditor(nodeId: NodeId, text: string, commit: (text: string) => void): void {
    this.closeEditor();
    this.editorNodeId = nodeId;
    this.editor.open({
      text,
      onCommit: (typed) => {
        this.closeEditor();
        commit(typed.trim());
      },
      onCancel: () => this.closeEditor(),
    });
    this.host.requestRepaint();
  }

  private closeEditor(): void {
    this.editor.close();
    this.editorNodeId = null;
    this.local.clearDraft();
    this.host.requestRepaint();
  }

  private reopenForRetry(request: EditRequest): void {
    if (request.type === 'rename') this.openRename(request.nodeId, request.text);
    else if (request.type === 'add') this.openAddDraft(request.parentId, request.side, request.text);
  }

  private editorPlacement(scene: Scene, nodeId: NodeId): LabelEditorPlacement | null {
    const box = nodeBoxOf(scene, nodeId);
    if (box === null) return null;
    const config = this.host.config();
    const { zoom } = this.host.view.view;
    const style = config.text.node;
    const isRoot = scene.tree.nodeById(nodeId).parentId === null;
    return {
      center: this.host.view.sceneToScreen(box.center),
      width: box.size.width * EDITOR_WIDTH_FRACTION * zoom,
      fontSizePx: style.sizePx * zoom,
      fontFamily: this.host.cssFontFamily(this.host.fonts().node),
      bold: nodeLabelInk(config, isRoot).bold,
      letterSpacingEm: style.letterSpacingEm,
      color: nodeLabelInk(config, isRoot).fill,
      background: scene.colors.get(nodeId)?.fill ?? config.theme.color.background,
    };
  }

  // ---- edits ----

  private submitFromEditor(request: EditRequest): void {
    this.local.sentFromEditor(request);
    this.submit(request);
  }

  /** Refusals (invalid, or another edit still pending) are shown, since nothing was sent (spec I3, I5.2). */
  private submit(request: EditRequest): void {
    const result = this.host.edits.submit(request);
    if (result.kind === 'refused') this.notice.show(result.reason);
  }

  /** Shows why an editor did not open, if it must not (see `LocalEditState.editorBlockedReason`). */
  private refusedWhilePending(): boolean {
    const reason = this.local.editorBlockedReason();
    if (reason === null) return false;
    this.notice.show(reason);
    return true;
  }

  // ---- hover and cursor ----

  private updateHover(screen: Point): void {
    if (this.painted === null || this.shownDrag() !== null) return;
    const target = this.targetAt(this.painted, screen);
    const nodeId = hoveredNodeOf(target);
    this.setHover(nodeId !== null && !isTransient(nodeId) ? nodeId : null, target.kind === 'handle' ? target.handle : null);
    this.updateCursor(target);
  }

  private setHover(nodeId: NodeId | null, handle: NodeHandle | null): void {
    if (nodeId === this.hoveredNodeId && sameHandle(handle, this.hoveredHandle)) return;
    this.hoveredNodeId = nodeId;
    this.hoveredHandle = handle;
    this.host.requestRepaint();
  }

  private updateCursor(target: PointerTarget | null = null): void {
    this.host.canvas.style.cursor = this.cursorFor(target);
  }

  private cursorFor(target: PointerTarget | null): string {
    if (this.askedDrop !== null) return CURSOR.idle;
    if (this.drag !== null) return CURSOR.grabbing;
    if (this.host.edits.status.kind === 'pending') return CURSOR.busy;
    if (target?.kind === 'handle') return CURSOR.button;
    if (target?.kind === 'node' && this.painted !== null && this.isMovable(this.painted, target.nodeId)) return CURSOR.grab;
    return CURSOR.idle;
  }

  /** Buttons hide while dragging (or asking about a drop), while an edit is pending, and when switched off in config. */
  private visibleHandles(scene: Scene): readonly NodeHandle[] {
    const busy = this.shownDrag() !== null || this.host.edits.status.kind === 'pending';
    return shownHandles(scene, { hoveredNodeId: this.hoveredNodeId, busy, interaction: this.host.config().interaction });
  }

  // ---- helpers ----

  /** The live drag, else the drop waiting for the user's answer. */
  private shownDrag(): NodeDrag | null {
    return this.drag ?? this.askedDrop;
  }

  private targetAt(scene: Scene, screen: Point): PointerTarget {
    const activeNodeId = this.visibleHandles(scene).length > 0 ? this.hoveredNodeId : null;
    return pointerTargetAt(scene, this.host.view.screenToScene(screen), this.host.extensions().nodeShape, activeNodeId);
  }

  private pressTargetAt(scene: Scene, screen: Point): PressTarget {
    const target = this.targetAt(scene, screen);
    switch (target.kind) {
      case 'handle':
        return target;
      case 'node':
        if (isTransient(target.nodeId)) return CANVAS_PRESS;
        // The root never moves (spec R23), so dragging it pans like empty canvas; a click still reports it.
        return this.isMovable(scene, target.nodeId) ? target : { kind: 'fixed-node', nodeId: target.nodeId };
      case 'near-handles':
      case 'empty':
        return CANVAS_PRESS;
    }
  }

  private isMovable(scene: Scene, nodeId: NodeId): boolean {
    return nodeId !== scene.tree.root.id && !isTransient(nodeId);
  }

  private toSceneOffset(screenOffset: Point): Point {
    const { zoom } = this.host.view.view;
    return { x: screenOffset.x / zoom, y: screenOffset.y / zoom };
  }

  /** CSS px relative to the canvas, the space `ViewController` works in. */
  private canvasPoint(event: MouseEvent): Point {
    const rect = this.host.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private listen<K extends keyof HTMLElementEventMap>(
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    const { canvas } = this.host;
    canvas.addEventListener(type, handler, options);
    this.removeListeners.push(() => canvas.removeEventListener(type, handler, options));
  }
}

/** Node whose buttons a pointer over `target` keeps shown, if any. */
function hoveredNodeOf(target: PointerTarget): NodeId | null {
  switch (target.kind) {
    case 'node':
    case 'near-handles':
      return target.nodeId;
    case 'handle':
      return target.handle.nodeId;
    case 'empty':
      return null;
  }
}

/**
 * Drag preview: the subtree follows the pointer (mirrored once it crosses its parent, like the drop will be) and
 * branches re-route (spec R8); other nodes stay put.
 */
function draggedScene(drag: NodeDrag, branchConfig: BranchConfig): Scene {
  const { base, paintTree: tree } = drag;
  const move = subtreeMoveBy(base.positions, tree, drag.nodeId, drag.offset);
  const positions = move === null ? base.positions : moveSubtree(base.positions, tree, move);
  return { ...base, tree, positions, branches: buildBranches({ tree, positions, sizes: base.sizes, config: branchConfig }) };
}

/**
 * Same tree, but nodes in `movedIds` come last so they paint over the nodes they are dragged across. First-level
 * sides are pinned first, because unsided first-level nodes take their side from data order.
 */
function treeWithSubtreeOnTop(tree: MindmapTree, movedIds: ReadonlySet<NodeId>): MindmapTree {
  const sided = tree.nodes.map((node) => {
    const side = tree.sideOf(node.id);
    return tree.depthOf(node.id) === 1 && side !== null ? { ...node, side } : node;
  });
  return buildTree([...sided.filter((node) => !movedIds.has(node.id)), ...sided.filter((node) => movedIds.has(node.id))]);
}
