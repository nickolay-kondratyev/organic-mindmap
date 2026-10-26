import { DEFAULT_CONFIG, type MindmapConfig } from './config';
import { SettingsPersistence, type SettingsStorage } from './settingsPersistence';

const CHANGED: MindmapConfig = { ...DEFAULT_CONFIG, branch: { ...DEFAULT_CONFIG.branch, taper: 0.5 } };
const CHANGED_AGAIN: MindmapConfig = { ...DEFAULT_CONFIG, branch: { ...DEFAULT_CONFIG.branch, taper: 0.6 } };
const CHANGED_LAST: MindmapConfig = { ...DEFAULT_CONFIG, branch: { ...DEFAULT_CONFIG.branch, taper: 0.7 } };

/** In-memory host storage; `holdWrites` keeps each write in flight until `releaseWrite` is called. */
interface FakeStorageOptions {
  readonly holdWrites?: boolean;
  readonly failLoad?: boolean;
  /** How many of the next writes reject. */
  readonly failWrites?: number;
}

class FakeSettingsStorage implements SettingsStorage {
  readonly writes: MindmapConfig[] = [];
  private readonly heldWrites: (() => void)[] = [];
  private stored: unknown;
  private readonly holdWrites: boolean;
  private readonly failLoad: boolean;
  private failuresLeft: number;

  constructor(stored: unknown = undefined, options: FakeStorageOptions = {}) {
    this.stored = stored;
    this.holdWrites = options.holdWrites ?? false;
    this.failLoad = options.failLoad ?? false;
    this.failuresLeft = options.failWrites ?? 0;
  }

  load(): Promise<unknown> {
    return this.failLoad ? Promise.reject(new Error('disk unreadable')) : Promise.resolve(this.stored);
  }

  async save(settings: MindmapConfig): Promise<void> {
    if (this.holdWrites) await new Promise<void>((resolve) => this.heldWrites.push(resolve));
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error('disk full');
    }
    this.writes.push(settings);
    this.stored = settings;
  }

  releaseWrite(): void {
    this.heldWrites.shift()?.();
  }
}

/** Lets pending promise callbacks run, so a released write finishes and the next one starts. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

const silentWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GIVEN storage holding saved settings', () => {
  it('WHEN loading THEN the saved settings are restored', async () => {
    const persistence = new SettingsPersistence(new FakeSettingsStorage(structuredClone(CHANGED)));
    expect(await persistence.load()).toEqual(CHANGED);
  });
});

describe('GIVEN storage holding partial settings', () => {
  it('WHEN loading THEN the missing settings are defaults', async () => {
    const persistence = new SettingsPersistence(new FakeSettingsStorage({ branch: { taper: 0.5 } }));
    expect(await persistence.load()).toEqual(CHANGED);
  });
});

describe('GIVEN empty storage', () => {
  it('WHEN loading THEN the defaults are returned', async () => {
    const persistence = new SettingsPersistence(new FakeSettingsStorage());
    expect(await persistence.load()).toBe(DEFAULT_CONFIG);
  });
});

describe('GIVEN storage that fails to load', () => {
  it('WHEN loading THEN the defaults are returned', async () => {
    silentWarnings();
    const persistence = new SettingsPersistence(new FakeSettingsStorage(undefined, { failLoad: true }));
    expect(await persistence.load()).toBe(DEFAULT_CONFIG);
  });

  it('WHEN loading THEN a warning is logged', async () => {
    const warn = silentWarnings();
    await new SettingsPersistence(new FakeSettingsStorage(undefined, { failLoad: true })).load();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('GIVEN idle storage', () => {
  it('WHEN settings change THEN they are saved', async () => {
    const storage = new FakeSettingsStorage();
    new SettingsPersistence(storage).save(CHANGED);
    await settle();
    expect(storage.writes).toEqual([CHANGED]);
  });
});

describe('GIVEN a save still in flight', () => {
  it('WHEN settings change twice more THEN only the latest is written after it', async () => {
    const storage = new FakeSettingsStorage(undefined, { holdWrites: true });
    const persistence = new SettingsPersistence(storage);
    persistence.save(CHANGED);
    persistence.save(CHANGED_AGAIN);
    persistence.save(CHANGED_LAST);
    storage.releaseWrite();
    await settle();
    storage.releaseWrite();
    await settle();
    expect(storage.writes).toEqual([CHANGED, CHANGED_LAST]);
  });
});

describe('GIVEN storage whose next write fails', () => {
  it('WHEN settings change THEN a warning is logged', async () => {
    const warn = silentWarnings();
    new SettingsPersistence(new FakeSettingsStorage(undefined, { failWrites: 1 })).save(CHANGED);
    await settle();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('WHEN settings change again after the failure THEN the new settings are saved', async () => {
    silentWarnings();
    const storage = new FakeSettingsStorage(undefined, { failWrites: 1 });
    const persistence = new SettingsPersistence(storage);
    persistence.save(CHANGED);
    await settle();
    persistence.save(CHANGED_AGAIN);
    await settle();
    expect(storage.writes).toEqual([CHANGED_AGAIN]);
  });
});
