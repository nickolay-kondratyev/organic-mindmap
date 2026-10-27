import { MarkdownView, Notice, Plugin, TFolder, WorkspaceLeaf, type ViewState } from 'obsidian';
import { REFERENCE_DATA, SettingsPersistence } from 'organic-mindmap';
import { CREATE_MINDMAP_COMMAND, SHOW_STATUS_COMMAND, TOGGLE_MINDMAP_VIEW_COMMAND } from './commands';
import { bundledFontFetcher } from './mapView/bundledFonts';
import { MindmapNoteView, VIEW_ICON } from './mapView/MindmapNoteView';
import { newMindmapNoteFileName, newNotePath, NEW_MINDMAP_FOLDER_MENU_TITLE, NEW_NOTE_ROOT_TEXT } from './mapView/newNote';
import { routeSetViewState } from './mapView/viewRouting';
import { MapSettings } from './settings/mapSettings';
import { MapSettingsTab } from './settings/MapSettingsTab';
import { MarkdownChoices, MARKDOWN_VIEW_TYPE, MINDMAP_VIEW_TYPE, resolveViewType } from './mapView/viewSwitch';
import { isMindmapNote, newMindmapNoteText } from './mindmapNote';
import { statusMessage } from './statusMessage';

export default class OrganicMindmapPlugin extends Plugin {
  private readonly markdownChoices = new MarkdownChoices<WorkspaceLeaf>();
  /** The look (and in-map choices) of every map; stored in the plugin's `data.json` through the library's seam. */
  private readonly settings = new MapSettings(
    new SettingsPersistence({ load: () => this.loadData(), save: (config) => this.saveData(config) }),
  );

  override async onload(): Promise<void> {
    // Before any view mounts: a map must start with the stored look, not the default and then a repaint.
    await this.settings.load();
    this.addSettingTab(new MapSettingsTab(this.app, this, this.settings));
    this.registerView(
      MINDMAP_VIEW_TYPE,
      (leaf) =>
        new MindmapNoteView(leaf, {
          fontFetcher: bundledFontFetcher,
          settings: this.settings,
          openAsMarkdown: (view) => this.openAsMarkdown(view),
        }),
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
      callback: () => this.createMindmapNoteIn(this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? '')),
    });
    this.addNewMindmapToFolderMenu();
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
   * so a file never needs to be indexed first. Unwrapped when the plugin unloads (`viewRouting.ts` keeps other
   * plugins' wrappers of the same method intact).
   * WHY-NOT `registerExtensions`: it claims a file extension, and these notes are `.md` like every other note.
   */
  private routeMindmapNotesToMap(): void {
    this.register(
      routeSetViewState<ViewState, WorkspaceLeaf>(WorkspaceLeaf.prototype, (leaf, viewState) =>
        this.routedViewStateOrRequested(leaf, viewState),
      ),
    );
  }

  /** Routing must never block opening a file: a failed detection (e.g. the file vanished mid-read) opens as requested. */
  private async routedViewStateOrRequested(leaf: WorkspaceLeaf, viewState: ViewState): Promise<ViewState> {
    try {
      return await this.routedViewState(leaf, viewState);
    } catch (error) {
      console.error('organic-mindmap: could not decide the view for the note, opening it as requested', error);
      return viewState;
    }
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

  /**
   * Folders only, like Obsidian's own "New note" there (right-clicking the explorer's empty space gives the vault root
   * folder). WHY-NOT on files too: `file-menu` also fills a note's tab "..." menu, where creating a map is out of place.
   */
  private addNewMindmapToFolderMenu(): void {
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem((item) =>
          item
            .setTitle(NEW_MINDMAP_FOLDER_MENU_TITLE)
            .setIcon(VIEW_ICON)
            .onClick(() => this.createMindmapNoteIn(file)),
        );
      }),
    );
  }

  /** Creates the note in `folder` and opens it as a map; a failure is shown as a `Notice`, never thrown. */
  private createMindmapNoteIn(folder: TFolder): void {
    void this.createAndOpenMindmapNote(folder).catch((error: unknown) => {
      new Notice(`Could not create the mindmap note: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private async createAndOpenMindmapNote(folder: TFolder): Promise<void> {
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
