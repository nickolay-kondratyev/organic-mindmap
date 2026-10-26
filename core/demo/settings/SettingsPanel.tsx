import { DEFAULT_CONFIG, type MindmapConfig } from 'organic-mindmap';
import { PanelSection } from '../PanelSection';
import { valueAt, withValueAt } from './configPath';
import { SettingControl } from './SettingControl';
import { isAtDefaults, settingSections, type SettingSection } from './settingsModel';

/** Derived once: the config shape does not change at runtime, only its values. */
const SECTIONS = settingSections(DEFAULT_CONFIG);
/** Short sections worth seeing first; the rest stay folded so the panel is scannable. */
const OPEN_BY_DEFAULT: ReadonlySet<SettingSection['key']> = new Set(['node', 'branch']);

interface SettingsPanelProps {
  readonly config: MindmapConfig;
  /** Takes an updater, not a value, so two changes in one tick both apply (no stale `config` closure). */
  readonly onChange: (update: (config: MindmapConfig) => MindmapConfig) => void;
}

/** Live controls for every config setting plus reset to defaults (spec D3). */
export function SettingsPanel({ config, onChange }: SettingsPanelProps) {
  const resetButton = (
    <button type="button" className="button button--small" disabled={isAtDefaults(config)} onClick={() => onChange(() => DEFAULT_CONFIG)}>
      Reset settings
    </button>
  );
  return (
    <PanelSection title="Settings" actions={resetButton}>
      {SECTIONS.map((section) => (
        <details key={section.key} className="settings-section" open={OPEN_BY_DEFAULT.has(section.key)}>
          <summary>{section.title}</summary>
          {section.groups.map((group) => (
            <fieldset key={group.id} className="settings-group">
              {group.title !== '' && <legend>{group.title}</legend>}
              {group.fields.map((field) => {
                const value = valueAt(config, field.path);
                return (
                  <SettingControl
                    key={field.id}
                    field={field}
                    value={value}
                    changed={value !== valueAt(DEFAULT_CONFIG, field.path)}
                    onChange={(next) => onChange((current) => withValueAt(current, field.path, next))}
                  />
                );
              })}
            </fieldset>
          ))}
        </details>
      ))}
    </PanelSection>
  );
}
