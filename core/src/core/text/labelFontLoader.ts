import type { TextConfig } from '../config/config';
import { FontStore, type FontEntry, type FontFetcher, type FontStatus } from './fontStore';
import type { LoadedFont } from './loadedFont';

/** Fonts available for one paint; `null` while loading or after an error, which skips that text (spec L6, R16). */
export interface LabelFonts {
  readonly node: LoadedFont | null;
  readonly branch: LoadedFont | null;
}

/** What hosts observe to show a loading state (spec L6); node and branch fonts are independent (spec R18). */
export interface LabelFontStatus {
  readonly node: FontStatus;
  readonly branch: FontStatus;
}

export interface LabelFontLoaderCallbacks {
  /** A font finished loading or failed: repaint. */
  readonly onFontsChanged: () => void;
  /** Called with every distinct status, including the first one. */
  readonly onStatusChange: (status: LabelFontStatus) => void;
}

/**
 * Tracks the node and branch fonts named by the current text config: starts loads when the config names a
 * new URL, hands the renderer whatever is loaded, and publishes status changes.
 */
export class LabelFontLoader {
  private readonly store: FontStore;
  private text: TextConfig | null = null;
  private published: LabelFontStatus | null = null;
  private disposed = false;

  constructor(
    fetcher: FontFetcher,
    private readonly callbacks: LabelFontLoaderCallbacks,
  ) {
    this.store = new FontStore(fetcher, () => this.onSettled());
  }

  /** Switches to the fonts named by `text`, loading any that are new. */
  use(text: TextConfig): void {
    this.text = text;
    this.publishIfChanged();
  }

  fonts(): LabelFonts {
    return { node: loadedFont(this.nodeEntry()), branch: loadedFont(this.branchEntry()) };
  }

  status(): LabelFontStatus {
    return { node: this.nodeEntry().status, branch: this.branchEntry().status };
  }

  /** Stops callbacks; loads still in flight settle silently. */
  dispose(): void {
    this.disposed = true;
  }

  private nodeEntry(): FontEntry {
    return this.store.load(this.requireText().node.url);
  }

  private branchEntry(): FontEntry {
    return this.store.load(this.requireText().branch.url);
  }

  private requireText(): TextConfig {
    if (this.text === null) throw new Error('LabelFontLoader.use(textConfig) must be called before reading fonts');
    return this.text;
  }

  private onSettled(): void {
    if (this.disposed) return;
    this.publishIfChanged();
    this.callbacks.onFontsChanged();
  }

  private publishIfChanged(): void {
    if (this.disposed) return;
    const status = this.status();
    if (this.published !== null && this.published.node === status.node && this.published.branch === status.branch) return;
    this.published = status;
    this.callbacks.onStatusChange(status);
  }
}

function loadedFont(entry: FontEntry): LoadedFont | null {
  return entry.status === 'loaded' ? entry.font : null;
}
