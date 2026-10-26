import { Notice, Plugin } from 'obsidian';
import { REFERENCE_DATA } from 'organic-mindmap';
import { SHOW_STATUS_COMMAND } from './commands';
import { statusMessage } from './statusMessage';

/** Minimal plugin: one command that reports the plugin is loaded and the library is bundled. Map features come later. */
export default class OrganicMindmapPlugin extends Plugin {
  override onload(): void {
    this.addCommand({
      id: SHOW_STATUS_COMMAND.id,
      name: SHOW_STATUS_COMMAND.name,
      callback: () => {
        new Notice(statusMessage(this.manifest.version, REFERENCE_DATA));
      },
    });
  }
}
