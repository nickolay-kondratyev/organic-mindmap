import { FileView, Menu, Notice, Scope, type TFile, type WorkspaceLeaf } from 'obsidian';
import {
  mountMindmap,
  type EditRequest,
  type FontFetcher,
  type MindmapData,
  type MindmapHandle,
  type NodeClickEvent,
  type NodeContextMenuEvent,
  type NodeId,
  type NodeOffsets,
  type NodeOffsetsChangeCause,
} from 'organic-mindmap';
import type { MindmapNote } from '../mindmapNote';
import { DELETE_LABEL, UNDO_LABEL } from './deleteLabels';
import { EditHistory } from './editHistory';
import { firstLinkTarget } from './linkTarget';
import { MindmapNoteSession, NoteClosedError, type NoteTextFile, type UndoResult } from './noteSession';
import { keyBelongsToTextEntry } from './textEntryFocus';
import { MINDMAP_VIEW_TYPE } from './viewSwitch';

export const OPEN_AS_MARKDOWN_LABEL = 'Open as Markdown';
const VIEW_ICON = 'git-fork';
const DELETED_MESSAGE = 'Deleted from the mindmap.';
const NOTHING_TO_UNDO_MESSAGE = 'Nothing to undo on the map.';
const NOTHING_TO_REDO_MESSAGE = 'Nothing to redo on the map.';
/** Shown once per lost history: the map's steps only apply to the text they left (same rule as every map write). */
const UNDO_CHANGED_SINCE_MESSAGE =
  'Nothing to undo from the map: the note changed outside the map (e.g. in a Markdown tab or by sync). Use the Markdown view or file recovery to go back further.';
const REDO_CHANGED_SINCE_MESSAGE = 'Nothing to redo from the map: the note changed outside the map since the undo.';
const UNDO_FAILED_PREFIX = 'Could not undo:';
const REDO_FAILED_PREFIX = 'Could not redo:';
const UNDO_KEY = 'z';
/** Long enough to notice the delete and reach "Undo". */
const UNDO_NOTICE_MS = 10_000;

export interface MindmapNoteViewDeps {
  readonly fontFetcher: FontFetcher;
  /** Opens this view's note as Markdown in the same leaf (the plugin remembers the choice for the leaf). */
  readonly openAsMarkdown: (view: MindmapNoteView) => Promise<void>;
}

/**
 * The map of one mindmap note: reads the note, mounts the library's map on a canvas, writes map edits back
 * through the format and `vault.process`, and re-reads whenever the file changes (typing in a Markdown tab,
 * sync, Obsidian rewriting a link after a rename). Each view owns its session and mount, so two open maps share
 * nothing.
 * WHY a `FileView`, not a `TextFileView`: `TextFileView` keeps its own text and saves it back on its own schedule
 * (e.g. when the view unloads), which could overwrite a newer file with the map's stale text. Here every write is
 * one `vault.process` against the text the map was drawn from, and the view never saves otherwise.
 */
export class MindmapNoteView extends FileView {
  private readonly session = new MindmapNoteSession();
  /** Undo/redo steps of this view's writes to the note it shows now; dropped with the note. */
  private readonly history = new EditHistory();
  private handle: MindmapHandle | null = null;
  private resizeObserver: ResizeObserver | null = null;
  /** The note the mounted map currently draws, to skip `setData` when a reload yields the same note. */
  private shownNote: MindmapNote | null = null;
  /** The open "Undo" notice of the last delete; it only makes sense while this view shows that note. */
  private undoNotice: Notice | null = null;
  /** Counts `reloadFromFile` calls so a slower, older read never overwrites a newer one. */
  private latestReload = 0;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: MindmapNoteViewDeps,
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return MINDMAP_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return this.file?.basename ?? 'Mindmap';
  }

  override getIcon(): string {
    return VIEW_ICON;
  }

  override canAcceptExtension(extension: string): boolean {
    return extension === 'md';
  }

  /** The library handle while a readable note is shown (host UI and E2E read the map through it). */
  get mapHandle(): MindmapHandle | null {
    return this.handle;
  }

  override onload(): void {
    super.onload();
    this.contentEl.addClass('organic-mindmap-view');
    // Obsidian keeps the view's scope active only while the view is the active (focused) one.
    this.scope = new Scope(this.app.scope);
    this.scope.register(['Mod'], UNDO_KEY, (event) => this.handleHistoryKey(event, () => this.undo()));
    this.scope.register(['Mod', 'Shift'], UNDO_KEY, (event) => this.handleHistoryKey(event, () => this.redo()));
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (this.file !== null && file.path === this.file.path) void this.reloadFromFile();
      }),
    );
  }

  override async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    await this.reloadFromFile();
  }

  override async onUnloadFile(file: TFile): Promise<void> {
    // The same view (and session) shows the next file: writes still in flight for this one must not load into it.
    this.session.close();
    this.history.clear();
    this.unmount();
    this.contentEl.empty();
    await super.onUnloadFile(file);
  }

  override onunload(): void {
    this.session.close();
    this.unmount();
    super.onunload();
  }

  override onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source);
    menu.addItem((item) =>
      item
        .setTitle(OPEN_AS_MARKDOWN_LABEL)
        .setIcon('file-text')
        .onClick(() => void this.deps.openAsMarkdown(this)),
    );
  }

  private async reloadFromFile(): Promise<void> {
    const file = this.file;
    if (file === null) return;
    const reload = ++this.latestReload;
    // `read` (disk), not `cachedRead`: a reload must see what was just written, never a cached older text.
    const text = await this.app.vault.read(file);
    // The file may have been closed while reading. Back-to-back writes (a reparent, then its saved positions) start
    // overlapping reads that may resolve out of order: only the newest may load, else an older text would win.
    if (this.file !== file || reload !== this.latestReload) return;
    this.session.load(text);
    this.render();
  }

  /** Shows the session's state: the map for a readable note (mounting it once), else the problem. */
  private render(): void {
    const state = this.session.state;
    if (state.kind !== 'read') {
      this.unmount();
      if (state.kind === 'problem') this.renderProblem(state.problem);
      return;
    }
    if (this.handle === null) {
      this.mount(state.note);
    } else if (state.note !== this.shownNote) {
      // A change from outside the map (typing, sync, undo): the note's saved positions win over the map's.
      this.handle.setData(state.note.toMindmapData());
      this.handle.setNodeOffsets(state.note.positions);
    }
    this.shownNote = state.note;
  }

  private mount(note: MindmapNote): void {
    this.contentEl.empty();
    const canvas = this.contentEl.createEl('canvas');
    this.handle = mountMindmap(canvas, {
      data: note.toMindmapData(),
      nodeOffsets: note.positions,
      fontFetcher: this.deps.fontFetcher,
      onEditRequest: (request) => this.writeEdit(request),
      onNodeOffsetsChange: (offsets, cause) => void this.savePositions(offsets, cause),
      onNodeClick: (event) => this.openNodeLink(event),
      onNodeContextMenu: (event) => this.showNodeMenu(event),
    });
    this.resizeObserver = new ResizeObserver(() => this.fitBitmapToCanvas(canvas));
    this.resizeObserver.observe(canvas);
    this.fitBitmapToCanvas(canvas);
  }

  private unmount(): void {
    this.undoNotice?.hide();
    this.undoNotice = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.handle?.destroy();
    this.handle = null;
    this.shownNote = null;
  }

  /**
   * WHY the canvas's own size, not `contentEl`'s: Obsidian pads `.view-content` (12px 12px 32px in 1.12), so the
   * pane's `clientWidth/Height` is bigger than the canvas filling it. A bitmap sized to the pane gets scaled down
   * into the canvas box, and everything drawn shifts up-left of where pointer events are hit-tested: the "+" a
   * person saw was ~27px away from the one that reacts (ticket nid_76v6o4a80srw0tqec4ljx2hqw_e).
   */
  private fitBitmapToCanvas(canvas: HTMLCanvasElement): void {
    if (this.handle === null) return;
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.handle.resize(clientWidth, clientHeight, window.devicePixelRatio);
  }

  private renderProblem(problem: string): void {
    this.contentEl.empty();
    const box = this.contentEl.createDiv({ cls: 'organic-mindmap-problem' });
    box.createEl('p', { text: problem });
    box.createEl('button', { text: OPEN_AS_MARKDOWN_LABEL }).addEventListener('click', () => void this.deps.openAsMarkdown(this));
  }

  /** The library's `onEditRequest`: the written note's data, or a rejection with the plain reason. */
  private async writeEdit(request: EditRequest): Promise<MindmapData> {
    const file = this.noteFile();
    try {
      const { data, snapshot } = await this.session.applyEdit(request, file);
      this.shownNote = this.session.note;
      this.history.record(snapshot);
      if (request.type === 'delete') this.offerUndo();
      return data;
    } catch (error) {
      // A stale refusal reloaded the session from the file's newer text: show it. A closed note has nothing to show
      // (the map that asked is gone and ignores the answer).
      if (!(error instanceof NoteClosedError)) this.render();
      throw error;
    }
  }

  /**
   * The library's `onNodeOffsetsChange`: the whole reported set becomes the note's layout block. The positions a
   * confirmed move drops belong to the move's undo step (one person action, one Ctrl+Z); a drop is its own step.
   */
  private async savePositions(offsets: NodeOffsets, cause: NodeOffsetsChangeCause): Promise<void> {
    try {
      const snapshot = await this.session.savePositions(offsets, this.noteFile());
      this.shownNote = this.session.note;
      if (cause === 'confirmedMove') this.history.recordInLastStep(snapshot);
      else this.history.record(snapshot);
    } catch (error) {
      if (error instanceof NoteClosedError) return;
      // The map already shows the drop; show the file's state again (positions included) and say why.
      this.render();
      new Notice(errorMessage(error));
    }
  }

  private showNodeMenu(event: NodeContextMenuEvent): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle(DELETE_LABEL)
        .setIcon('trash-2')
        .onClick(() => this.requestDelete(event.nodeId)),
    );
    menu.showAtPosition({ x: event.clientPoint.x, y: event.clientPoint.y });
  }

  private requestDelete(nodeId: NodeId): void {
    const submitted = this.handle?.requestEdit({ type: 'delete', nodeId });
    // Refused up front (e.g. the root, or another edit still saving): nothing else shows the reason.
    if (submitted?.kind === 'refused') new Notice(submitted.reason);
  }

  /** Destructive ops need undo: a notice with "Undo" (the same undo as Ctrl+Z, which the notice also teaches). */
  private offerUndo(): void {
    const message = createFragment((fragment) => {
      fragment.createSpan({ text: `${DELETED_MESSAGE} ` });
      // Any click on a notice hides it, so the button needs no hide call of its own.
      fragment.createEl('button', { text: UNDO_LABEL }).addEventListener('click', () => void this.undo());
    });
    this.undoNotice?.hide();
    this.undoNotice = new Notice(message, UNDO_NOTICE_MS);
  }

  /** Mod+Z / Mod+Shift+Z: the map's history, unless a text field or dialog has focus (then its own native undo). */
  private handleHistoryKey(event: KeyboardEvent, action: () => Promise<void>): false | undefined {
    if (keyBelongsToTextEntry(event.target instanceof HTMLElement ? event.target : null)) return undefined;
    void action();
    // `false` tells Obsidian to `preventDefault`.
    return false;
  }

  private async undo(): Promise<void> {
    const step = this.history.takeUndo();
    if (step === null) {
      new Notice(NOTHING_TO_UNDO_MESSAGE);
      return;
    }
    await this.replayStep({
      write: (file) => this.session.undo(step, file),
      landed: () => this.history.undone(step),
      changedSinceMessage: UNDO_CHANGED_SINCE_MESSAGE,
      failedPrefix: UNDO_FAILED_PREFIX,
    });
  }

  private async redo(): Promise<void> {
    const step = this.history.takeRedo();
    if (step === null) {
      new Notice(NOTHING_TO_REDO_MESSAGE);
      return;
    }
    await this.replayStep({
      write: (file) => this.session.redo(step, file),
      landed: () => this.history.redone(step),
      changedSinceMessage: REDO_CHANGED_SINCE_MESSAGE,
      failedPrefix: REDO_FAILED_PREFIX,
    });
  }

  /**
   * One undo or redo write: shows the file as written; moves the step to the other stack when it landed, else drops
   * the whole history (every step builds on the text the previous one left) and says why.
   */
  private async replayStep(step: {
    write: (file: NoteTextFile) => Promise<UndoResult>;
    landed: () => void;
    changedSinceMessage: string;
    failedPrefix: string;
  }): Promise<void> {
    try {
      const result = await step.write(this.noteFile());
      this.render();
      if (result === 'restored') {
        step.landed();
      } else {
        this.history.clear();
        new Notice(step.changedSinceMessage);
      }
    } catch (error) {
      if (error instanceof NoteClosedError) return;
      // E.g. the file could not be written: without this the key press would fail silently.
      new Notice(`${step.failedPrefix} ${errorMessage(error)}`);
    }
  }

  /** Every write is one `vault.process` on the open note. */
  private noteFile(): NoteTextFile {
    const file = this.file;
    if (file === null) throw new Error('The map has no note to write to');
    return { process: (change) => this.app.vault.process(file, change) };
  }

  private openNodeLink(event: NodeClickEvent): void {
    const node = this.session.note?.nodes.find((candidate) => candidate.id === event.nodeId);
    const target = node === undefined ? null : firstLinkTarget(node.rawText);
    if (target === null || this.file === null) return;
    const inNewTab = event.ctrlKey || event.metaKey;
    void this.app.workspace.openLinkText(target, this.file.path, inNewTab);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
