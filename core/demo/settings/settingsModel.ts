import { DEFAULT_CONFIG, type MindmapConfig } from 'organic-mindmap';
import { dottedPath, valueAt, type ConfigPath } from './configPath';
import { FIELD_LABELS, GROUP_TITLES, NUMBER_RANGES, SECTION_TITLES, STRING_CHOICES, type NumberRange, type NumberSettingPath } from './settingSpecs';

interface FieldBase {
  readonly path: ConfigPath;
  /** Dotted path; unique, so it doubles as React key, element id and test id. */
  readonly id: string;
  readonly label: string;
}

export type SettingField =
  | (FieldBase & { readonly kind: 'number'; readonly range: NumberRange })
  | (FieldBase & { readonly kind: 'color' })
  | (FieldBase & { readonly kind: 'text' })
  | (FieldBase & { readonly kind: 'toggle' })
  | (FieldBase & { readonly kind: 'choice'; readonly options: readonly string[] });

export interface SettingGroup {
  readonly id: string;
  /** Empty for a section's own fields, which need no heading. */
  readonly title: string;
  readonly fields: readonly SettingField[];
}

export interface SettingSection {
  readonly key: keyof MindmapConfig;
  readonly title: string;
  readonly groups: readonly SettingGroup[];
}

/** `<input type="color">` only understands `#rrggbb`; other color strings (e.g. `rgba(...)`) get a text field. */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const UNIT_SUFFIXES: Readonly<Record<string, string>> = { Px: 'px', Em: 'em', Ms: 'ms' };

/**
 * Settings panel model (spec D3), derived from the config's shape so a new config field shows up without panel
 * code. Per object: its own leaves form one group, then each nested object/array entry its own group.
 */
export function settingSections(config: MindmapConfig): readonly SettingSection[] {
  return (Object.keys(SECTION_TITLES) as (keyof MindmapConfig)[]).map((key) => ({
    key,
    title: SECTION_TITLES[key],
    groups: groupsOf(config[key], [key]),
  }));
}

/** Every setting of the default config, flattened; the shape does not change at runtime. */
const DEFAULT_FIELDS: readonly SettingField[] = settingSections(DEFAULT_CONFIG).flatMap((section) => section.groups.flatMap((group) => group.fields));

/**
 * Compares by value, not identity: settings loaded from storage equal the defaults without being `DEFAULT_CONFIG`,
 * and "Reset settings" should still read as having nothing to reset.
 */
export function isAtDefaults(config: MindmapConfig): boolean {
  return DEFAULT_FIELDS.every((field) => valueAt(config, field.path) === valueAt(DEFAULT_CONFIG, field.path));
}

function groupsOf(value: unknown, path: ConfigPath): SettingGroup[] {
  const entries = childEntries(value, path);
  const leaves = entries.filter((entry) => !isBranch(entry.value));
  const ownGroup: SettingGroup[] =
    leaves.length === 0 ? [] : [{ id: dottedPath(path), title: groupTitle(path), fields: leaves.map((leaf) => fieldFor(leaf.value, leaf.path)) }];
  const nested = entries.filter((entry) => isBranch(entry.value)).flatMap((entry) => groupsOf(entry.value, entry.path));
  return [...ownGroup, ...nested];
}

interface ChildEntry {
  readonly path: ConfigPath;
  readonly value: unknown;
}

function childEntries(value: unknown, path: ConfigPath): ChildEntry[] {
  if (Array.isArray(value)) return value.map((item: unknown, index) => ({ path: [...path, index], value: item }));
  return Object.entries(value as Record<string, unknown>).map(([key, item]) => ({ path: [...path, key], value: item }));
}

function isBranch(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

function fieldFor(value: unknown, path: ConfigPath): SettingField {
  const id = dottedPath(path);
  const base: FieldBase = { path, id, label: fieldLabel(path) };
  if (typeof value === 'number') return { ...base, kind: 'number', range: rangeFor(id) };
  if (typeof value === 'boolean') return { ...base, kind: 'toggle' };
  if (typeof value === 'string') {
    const options = (STRING_CHOICES as Readonly<Record<string, readonly string[]>>)[id];
    if (options !== undefined) return { ...base, kind: 'choice', options };
    return { ...base, kind: HEX_COLOR.test(value) ? 'color' : 'text' };
  }
  throw new Error(`Setting path=[${id}] has a value the settings panel cannot edit: [${String(value)}]`);
}

function rangeFor(id: string): NumberRange {
  // Numbers inside arrays (e.g. a future palette field) are outside `NumberSettingPath`, so check at runtime too.
  const range = (NUMBER_RANGES as Readonly<Partial<Record<string, NumberRange>>>)[id as NumberSettingPath];
  if (range === undefined) throw new Error(`Setting path=[${id}] has no slider range; add one to NUMBER_RANGES`);
  return range;
}

function fieldLabel(path: ConfigPath): string {
  const key = String(path[path.length - 1]);
  return FIELD_LABELS[key] ?? humanize(key);
}

function groupTitle(path: ConfigPath): string {
  const override = GROUP_TITLES[dottedPath(path)];
  if (override !== undefined) return override;
  if (path.length === 1) return '';
  const last = path[path.length - 1] as string | number;
  // Array entries are numbered from 1 after their array's name, e.g. "Palette 3".
  if (typeof last === 'number') return `${humanize(String(path[path.length - 2]))} ${last + 1}`;
  return humanize(last);
}

/** `letterSpacingEm` -> `Letter spacing (em)`: camelCase words, a trailing unit moved into brackets. */
export function humanize(key: string): string {
  const words = key.split(/(?=[A-Z])/);
  const unit = UNIT_SUFFIXES[words[words.length - 1] ?? ''];
  const nameWords = unit === undefined ? words : words.slice(0, -1);
  const name = nameWords.map((word) => word.toLowerCase()).join(' ');
  const sentence = name.charAt(0).toUpperCase() + name.slice(1);
  return unit === undefined ? sentence : `${sentence} (${unit})`;
}

/** Shows as many decimals as the slider step has, so the readout never jitters in length while dragging. */
export function formatNumber(value: number, step: number): string {
  const decimals = String(step).split('.')[1]?.length ?? 0;
  return value.toFixed(decimals);
}
