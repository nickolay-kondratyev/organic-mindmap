import { useCallback, useEffect, useRef, useState } from 'react';
import type { MindmapConfig, SettingsPersistence } from 'natural-mindmap';

export type ConfigUpdate = (update: (config: MindmapConfig) => MindmapConfig) => void;

export interface PersistedConfig {
  /** `null` until the stored settings are loaded, so the map never paints (or fetches fonts for) the defaults first. */
  readonly config: MindmapConfig | null;
  readonly updateConfig: ConfigUpdate;
}

/** Settings that load from `persistence` once and save every change back to it. */
export function usePersistedConfig(persistence: SettingsPersistence): PersistedConfig {
  const [config, setConfig] = useState<MindmapConfig | null>(null);
  // WHY: the loaded settings are already stored, so they are not written back.
  const loadedRef = useRef<MindmapConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    void persistence.load().then((loaded) => {
      if (cancelled) return;
      loadedRef.current = loaded;
      setConfig(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [persistence]);

  useEffect(() => {
    if (config !== null && config !== loadedRef.current) persistence.save(config);
  }, [config, persistence]);

  const updateConfig = useCallback<ConfigUpdate>((update) => setConfig((current) => (current === null ? null : update(current))), []);
  return { config, updateConfig };
}
