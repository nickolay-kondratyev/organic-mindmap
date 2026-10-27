import { PluginSettingTab, type App, type Plugin } from 'obsidian';
import { addLookSettingRows } from './lookSettingRows';
import type { MapSettings } from './mapSettings';

/**
 * The "Organic Mindmap" settings tab: the few look settings a person changes (ticket nid_3dc4tbkt1il822ulzdmloxna1_e).
 * The rows come from `addLookSettingRows`, shared with every other surface showing them. Obsidian guidelines: no
 * top-level heading.
 */
export class MapSettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly settings: MapSettings,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    addLookSettingRows(containerEl, this.settings, () => this.display());
  }
}
