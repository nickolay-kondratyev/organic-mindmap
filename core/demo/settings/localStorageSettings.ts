import type { MindmapConfig, SettingsStorage } from 'natural-mindmap';

export const SETTINGS_STORAGE_KEY = 'natural-mindmap-demo:settings';

/** The demo's host side of the settings storage seam: one JSON entry in the browser's `localStorage`. */
export class LocalStorageSettings implements SettingsStorage {
  constructor(private readonly store: Pick<Storage, 'getItem' | 'setItem'>) {}

  async load(): Promise<unknown> {
    const json = this.store.getItem(SETTINGS_STORAGE_KEY);
    return json === null ? undefined : (JSON.parse(json) as unknown);
  }

  async save(settings: MindmapConfig): Promise<void> {
    this.store.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }
}
