import type { MindmapConfig } from './config';
import { restoreConfig } from './restoreConfig';

/**
 * Host seam: where the user's settings survive between sessions (e.g. Obsidian `loadData`/`saveData`,
 * `localStorage`). Async because most real stores are. The library decides what to save and when; the host only
 * stores and returns it.
 */
export interface SettingsStorage {
  /** What the last `save` stored, or `undefined` when nothing is stored yet. Treated as untrusted. */
  load(): Promise<unknown>;
  /** `settings` is plain JSON-serializable data. */
  save(settings: MindmapConfig): Promise<void>;
}

/**
 * Library side of the settings storage seam: restores stored settings over the defaults and writes changes back.
 * Storage failures never break the map: a failed load yields the defaults, a failed write keeps the live settings;
 * both are logged.
 */
export class SettingsPersistence {
  private readonly storage: SettingsStorage;
  /** Latest settings not yet handed to the storage; `null` when the storage has caught up. */
  private unsaved: MindmapConfig | null = null;
  private writing = false;

  constructor(storage: SettingsStorage) {
    this.storage = storage;
  }

  async load(): Promise<MindmapConfig> {
    try {
      return restoreConfig(await this.storage.load());
    } catch (error) {
      console.warn('natural-mindmap: stored settings could not be loaded; using defaults', { error });
      return restoreConfig(undefined);
    }
  }

  /**
   * Fire-and-forget. At most one write is in flight; changes arriving meanwhile collapse into one follow-up write
   * of the latest, so a slider drag does not queue a write per step and an older write never lands last.
   */
  save(settings: MindmapConfig): void {
    this.unsaved = settings;
    if (!this.writing) void this.writeUntilCaughtUp();
  }

  private async writeUntilCaughtUp(): Promise<void> {
    this.writing = true;
    while (this.unsaved !== null) {
      const settings = this.unsaved;
      this.unsaved = null;
      try {
        await this.storage.save(settings);
      } catch (error) {
        console.warn('natural-mindmap: settings could not be saved', { error });
      }
    }
    this.writing = false;
  }
}
