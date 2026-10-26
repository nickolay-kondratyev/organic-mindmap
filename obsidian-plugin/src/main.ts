import { MarkdownView, Notice, Plugin, WorkspaceLeaf, type ViewState } from 'obsidian';
import { REFERENCE_DATA } from 'organic-mindmap';
import { CREATE_MINDMAP_COMMAND, SHOW_STATUS_COMMAND, TOGGLE_MINDMAP_VIEW_COMMAND } from './commands';
import { bundledFontFetcher } from './mapView/bundledFonts';
import { MindmapNoteView } from './mapView/MindmapNoteView';
import { newMindmapNoteFileName, newNotePath, NEW_NOTE_ROOT_TEXT } from './mapView/newNote';
import { MarkdownChoices, MARKDOWN_VIEW_TYPE, MINDMAP_VIEW_TYPE, resolveViewType } from './mapView/viewSwitch';
import { isMindmapNote, newMindmapNoteText } from './mindmapNote';
import { statusMessage } from './statusMessage';

export default class OrganicMindmapPlugin extends Plugin {
  private readonly markdownChoices = new MarkdownChoices<WorkspaceLeaf>();

  override onload(): void {
    this.registerView(
      MINDMAP_VIEW_TYPE,
      (leaf) => new MindmapNoteView(leaf, { fontFetcher: bundledFontFetcher, openAsMarkdown: (view) => this.openAsMarkdown(view) }),
    );
    this.routeMindmapNotesToMap();
    this.addCommand({
      id: SHOW_STATUS_COMMAND.id,
      name: SHOW_STATUS_COMMAND.name,
      callback: () => {
        new Notice(statusMessage(this.manifest.version, REFERENCE_DATA));
      },
    });
    this.addCommand({
      id: CREATE_MINDMAP_COMMAND.id,
      name: CREATE_MINDMAP_COMMAND.name,
      callback: () => void this.createMindmapNote(),
    });
    this.addCommand({
      id: TOGGLE_MINDMAP_VIEW_COMMAND.id,
      name: TOGGLE_MINDMAP_VIEW_COMMAND.name,
      checkCallback: (checking) => this.toggleMindmapView(checking),
    });
  }

  /**
   * Opens mindmap notes (frontmatter `organic-mindmap: 1`) as a map wherever Obsidian would open them as Markdown
   * (file explorer, links, quick switcher, history), by wrapping `WorkspaceLeaf.setViewState`, the way Kanban and
   * Excalidraw route their `.md` files. Detection reads the file text (`isMindmapNote`, the one detection rule),
   * so a file never needs to be indexed first. Unwrapped when the plugin unloads.
   * WHY-NOT `registerExtensions`: it claims a file extension, and these notes are `.md` like every other note.
   */
  private routeMindmapNotesToMap(): void {
    const plugin = this;
    const original = WorkspaceLeaf.prototype.setViewState;
    WorkspaceLeaf.prototype.setViewState = async function (this: WorkspaceLeaf, viewState: ViewState, eState?: unknown) {
      return original.call(this, await plugin.routedViewState(this, viewState), eState);
    };
    this.register(() => {
      WorkspaceLeaf.prototype.setViewState = original;
    });
  }

  private async routedViewState(leaf: WorkspaceLeaf, viewState: ViewState): Promise<ViewState> {
    const path = viewState.state?.['file'];
    if (viewState.type !== MARKDOWN_VIEW_TYPE || typeof path !== 'string') return viewState;
    const file = this.app.vault.getFileByPath(path);
    if (file === null) return viewState;
    const markdownChosen = this.markdownChoices.isMarkdownChosen(leaf, path);
    const type = resolveViewType({
      requestedType: viewState.type,
      isMindmapNote: isMindmapNote(await this.app.vault.cachedRead(file)),
      markdownChosen,
    });
    // The choice is for one note in this leaf; opening another note there ends it.
    if (!markdownChosen) this.markdownChoices.forget(leaf);
    return type === viewState.type ? viewState : { ...viewState, type };
  }

  private async createMindmapNote(): Promise<void> {
    const folder = this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? '');
    const path = newNotePath(folder.path, newMindmapNoteFileName(new Date()));
    const file = await this.app.vault.create(path, newMindmapNoteText(NEW_NOTE_ROOT_TEXT));
    await this.app.workspace.getLeaf(false).setViewState({ type: MINDMAP_VIEW_TYPE, state: { file: file.path }, active: true });
  }

  private async openAsMarkdown(view: MindmapNoteView): Promise<void> {
    const file = view.file;
    if (file === null) return;
    this.markdownChoices.chooseMarkdown(view.leaf, file.path);
    await view.leaf.setViewState({ type: MARKDOWN_VIEW_TYPE, state: { file: file.path }, active: true });
  }

  /** Map -> Markdown for the active map; Markdown -> map for an active editor on a mindmap note. */
  private toggleMindmapView(checking: boolean): boolean {
    const mapView = this.app.workspace.getActiveViewOfType(MindmapNoteView);
    if (mapView !== null && mapView.file !== null) {
      if (!checking) void this.openAsMarkdown(mapView);
      return true;
    }
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = markdownView?.file ?? null;
    if (markdownView === null || file === null || !isMindmapNote(markdownView.editor.getValue())) return false;
    if (!checking) {
      this.markdownChoices.forget(markdownView.leaf);
      void markdownView.leaf.setViewState({ type: MINDMAP_VIEW_TYPE, state: { file: file.path }, active: true });
    }
    return true;
  }
}
