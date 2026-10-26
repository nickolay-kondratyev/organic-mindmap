import { DEFAULT_CONFIG } from 'organic-mindmap';
import { LocalStorageSettings, SETTINGS_STORAGE_KEY } from './localStorageSettings';

/** The two `Storage` methods the demo uses, backed by a map (unit tests run without a DOM). */
class MapStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe('GIVEN empty browser storage', () => {
  it('WHEN loading THEN nothing is returned', async () => {
    expect(await new LocalStorageSettings(new MapStorage()).load()).toBeUndefined();
  });

  it('WHEN settings are saved and loaded again THEN the same settings come back', async () => {
    const settings = new LocalStorageSettings(new MapStorage());
    await settings.save(DEFAULT_CONFIG);
    expect(await settings.load()).toEqual(DEFAULT_CONFIG);
  });
});

describe('GIVEN corrupt data under the settings key', () => {
  it('WHEN loading THEN it rejects', async () => {
    const store = new MapStorage();
    store.setItem(SETTINGS_STORAGE_KEY, '{not json');
    await expect(new LocalStorageSettings(store).load()).rejects.toThrow(SyntaxError);
  });
});
