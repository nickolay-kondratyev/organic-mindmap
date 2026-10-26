import { FileView, type Menu, type TFile, type WorkspaceLeaf } from 'obsidian';
import {
  mountMindmap,
  type EditRequest,
  type FontFetcher,
  type MindmapData,
  type MindmapHandle,
  type NodeClickEvent,
} from 'organic-mindmap';
import type { MindmapNote } from '../mindmapNote';
import { firstLinkTarget } from './linkTarget';
import { MindmapNoteSession } from './noteSession';
import { MINDMAP_VIEW_TYPE } from './viewSwitch';

export const OPEN_AS_MARKDOWN_LABEL = 'Open as Markdown';
const VIEW_ICON = 'git-fork';

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
  private handle: MindmapHandle | null = null;
  private resizeObserver: ResizeObserver | null = null;
  /** The note the mounted map currently draws, to skip `setData` when a reload yields the same note. */
  private shownNote: MindmapNote | null = null;

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
    this.unmount();
    this.contentEl.empty();
    await super.onUnloadFile(file);
  }

  override onunload(): void {
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
    // `read` (disk), not `cachedRead`: a reload must see what was just written, never a cached older text.
    const text = await this.app.vault.read(file);
    // The file may have been closed while reading.
    if (this.file !== file) return;
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
      this.handle.setData(state.note.toMindmapData());
    }
    this.shownNote = state.note;
  }

  private mount(note: MindmapNote): void {
    this.contentEl.empty();
    const canvas = this.contentEl.createEl('canvas');
    this.handle = mountMindmap(canvas, {
      data: note.toMindmapData(),
      fontFetcher: this.deps.fontFetcher,
      onEditRequest: (request) => this.writeEdit(request),
      onNodeClick: (event) => this.openNodeLink(event),
    });
    this.resizeObserver = new ResizeObserver(() => this.fitCanvasToContent());
    this.resizeObserver.observe(this.contentEl);
    this.fitCanvasToContent();
  }

  private unmount(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.handle?.destroy();
    this.handle = null;
    this.shownNote = null;
  }

  private fitCanvasToContent(): void {
    if (this.handle === null) return;
    const { clientWidth, clientHeight } = this.contentEl;
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
    const file = this.file;
    if (file === null) throw new Error('The map has no note to write to');
    try {
      const data = await this.session.applyEdit(request, { process: (change) => this.app.vault.process(file, change) });
      this.shownNote = this.session.note;
      return data;
    } catch (error) {
      // A stale refusal reloaded the session from the file's newer text: show it.
      this.render();
      throw error;
    }
  }

  private openNodeLink(event: NodeClickEvent): void {
    const node = this.session.note?.nodes.find((candidate) => candidate.id === event.nodeId);
    const target = node === undefined ? null : firstLinkTarget(node.rawText);
    if (target === null || this.file === null) return;
    const inNewTab = event.ctrlKey || event.metaKey;
    void this.app.workspace.openLinkText(target, this.file.path, inNewTab);
  }
}
