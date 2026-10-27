import { DEFAULT_CONFIG, type MindmapConfig, type PaletteColor, type SettingsPersistence } from 'organic-mindmap';
import { fontChoice, withBundledFontsOnly, type FontId } from './fontChoices';

export type MapSettingsListener = (config: MindmapConfig) => void;

/**
 * The one map config every open map draws with, shared by the settings tab (writes) and the map views (read on
 * mount, follow through `onChange`). Every change is stored through the library's `SettingsPersistence` (the
 * host's `loadData`/`saveData` behind it) and pushed to the listeners at once, so a setting applies to every open
 * map immediately and survives a restart. Pure: no `obsidian` import, so Vitest covers it.
 */
export class MapSettings {
  private current: MindmapConfig = DEFAULT_CONFIG;
  private readonly listeners = new Set<MapSettingsListener>();

  constructor(private readonly persistence: SettingsPersistence) {}

  /** Restores the stored settings (untrusted, see `restoreConfig`); a stored font the plugin does not bundle falls back. */
  async load(): Promise<void> {
    this.current = withBundledFontsOnly(await this.persistence.load());
  }

  get config(): MindmapConfig {
    return this.current;
  }

  /** Called with every change after it is applied; returns the unsubscribe. */
  onChange(listener: MapSettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setPalette(palette: readonly PaletteColor[]): void {
    this.apply({ ...this.current, theme: { ...this.current.theme, color: { ...this.current.theme.color, palette } } });
  }

  setBackground(color: string): void {
    this.apply({ ...this.current, theme: { ...this.current.theme, color: { ...this.current.theme.color, background: color } } });
  }

  setNodeFont(id: FontId): void {
    this.apply({ ...this.current, text: { ...this.current.text, node: { ...this.current.text.node, url: fontChoice(id).url } } });
  }

  setBranchFont(id: FontId): void {
    this.apply({ ...this.current, text: { ...this.current.text, branch: { ...this.current.text.branch, url: fontChoice(id).url } } });
  }

  /** The settings tab's reset: only what the tab shows (colors, fonts, background); other stored settings stay. */
  resetLook(): void {
    this.apply({
      ...this.current,
      theme: {
        ...this.current.theme,
        color: { ...this.current.theme.color, palette: DEFAULT_CONFIG.theme.color.palette, background: DEFAULT_CONFIG.theme.color.background },
      },
      text: {
        ...this.current.text,
        node: { ...this.current.text.node, url: DEFAULT_CONFIG.text.node.url },
        branch: { ...this.current.text.branch, url: DEFAULT_CONFIG.text.branch.url },
      },
    });
  }

  /** A change made inside a map (the library's `onConfigChange`, e.g. "Don't ask again"): stored and shared like any other. */
  replace(config: MindmapConfig): void {
    this.apply(config);
  }

  private apply(config: MindmapConfig): void {
    this.current = config;
    this.persistence.save(config);
    for (const listener of this.listeners) listener(config);
  }
}
