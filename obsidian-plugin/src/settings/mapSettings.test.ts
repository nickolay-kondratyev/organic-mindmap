import { DEFAULT_CONFIG, SettingsPersistence, type MindmapConfig, type SettingsStorage } from 'organic-mindmap';
import { fontChoice } from './fontChoices';
import { MapSettings } from './mapSettings';
import { palettePreset } from './palettePresets';

/** In-memory host storage; `saved` is what the last write stored. */
class MemoryStorage implements SettingsStorage {
  saved: unknown = undefined;

  constructor(private stored: unknown = undefined) {}

  async load(): Promise<unknown> {
    return this.stored;
  }

  async save(settings: MindmapConfig): Promise<void> {
    this.saved = settings;
  }
}

async function loaded(stored?: unknown): Promise<{ settings: MapSettings; storage: MemoryStorage }> {
  const storage = new MemoryStorage(stored);
  const settings = new MapSettings(new SettingsPersistence(storage));
  await settings.load();
  return { settings, storage };
}

/** `SettingsPersistence.save` is fire-and-forget; one macrotask lets the write land. */
const flushWrites = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('MapSettings', () => {
  it('GIVEN nothing stored WHEN loaded THEN the config is the library default', async () => {
    const { settings } = await loaded();
    expect(settings.config).toBe(DEFAULT_CONFIG);
  });

  it('GIVEN a stored background WHEN loaded THEN the config carries it', async () => {
    const { settings } = await loaded({ theme: { color: { background: '#112233' } } });
    expect(settings.config.theme.color.background).toBe('#112233');
  });

  it('GIVEN a stored font the plugin does not bundle WHEN loaded THEN the default font is used', async () => {
    const { settings } = await loaded({ text: { node: { url: 'https://cdn.example/gone.ttf' } } });
    expect(settings.config.text.node.url).toBe(DEFAULT_CONFIG.text.node.url);
  });

  it('WHEN the background is set THEN listeners get the new config', async () => {
    const { settings } = await loaded();
    const seen: string[] = [];
    settings.onChange((config) => seen.push(config.theme.color.background));
    settings.setBackground('#ffffff');
    expect(seen).toEqual(['#ffffff']);
  });

  it('WHEN the background is set THEN the new config is stored', async () => {
    const { settings, storage } = await loaded();
    settings.setBackground('#ffffff');
    await flushWrites();
    expect((storage.saved as MindmapConfig).theme.color.background).toBe('#ffffff');
  });

  it('WHEN a palette preset is set THEN the config palette is that preset', async () => {
    const { settings } = await loaded();
    settings.setPalette(palettePreset('vivid').palette);
    expect(settings.config.theme.color.palette).toBe(palettePreset('vivid').palette);
  });

  it('WHEN the node font is set THEN only the node font URL changes', async () => {
    const { settings } = await loaded();
    settings.setNodeFont('nunito');
    expect({ node: settings.config.text.node.url, branch: settings.config.text.branch.url }).toEqual({
      node: fontChoice('nunito').url,
      branch: DEFAULT_CONFIG.text.branch.url,
    });
  });

  it('WHEN the branch font is set THEN the branch font keeps its outline width', async () => {
    const { settings } = await loaded();
    settings.setBranchFont('caveat');
    expect(settings.config.text.branch.outlineWidthPx).toBe(DEFAULT_CONFIG.text.branch.outlineWidthPx);
  });

  it('GIVEN changed look and "Don\'t ask again" WHEN the look is reset THEN the look is default and the other setting stays', async () => {
    const { settings } = await loaded({ interaction: { confirmReparent: false } });
    settings.setBackground('#ffffff');
    settings.setNodeFont('nunito');
    settings.setPalette(palettePreset('muted').palette);
    settings.resetLook();
    expect(settings.config).toEqual({ ...DEFAULT_CONFIG, interaction: { ...DEFAULT_CONFIG.interaction, confirmReparent: false } });
  });

  it('WHEN a map reports a config change THEN other listeners get it and it is stored', async () => {
    const { settings, storage } = await loaded();
    const fromMap = { ...DEFAULT_CONFIG, interaction: { ...DEFAULT_CONFIG.interaction, confirmReparent: false } };
    const seen: boolean[] = [];
    settings.onChange((config) => seen.push(config.interaction.confirmReparent));
    settings.replace(fromMap);
    await flushWrites();
    expect({ seen, stored: (storage.saved as MindmapConfig).interaction.confirmReparent }).toEqual({ seen: [false], stored: false });
  });

  it('GIVEN an unsubscribed listener WHEN a setting changes THEN it is not called', async () => {
    const { settings } = await loaded();
    const seen: string[] = [];
    const unsubscribe = settings.onChange((config) => seen.push(config.theme.color.background));
    unsubscribe();
    settings.setBackground('#ffffff');
    expect(seen).toEqual([]);
  });
});
