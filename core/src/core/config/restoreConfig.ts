import { DEFAULT_LAYOUT_CONFIG, isLayoutType } from '../layout/layoutConfig';
import { isSideOrder } from '../model/tree';
import { DEFAULT_CONFIG, type MindmapConfig } from './config';

/**
 * Turns untrusted stored settings (an older library version, partial or hand-edited data) into a valid config:
 * every leaf of `DEFAULT_CONFIG` takes the stored value when it has the default's type, else the default. Unknown
 * keys are dropped. Arrays (the palette) are taken whole only when every entry is well-formed and the length is the
 * default's: the settings controls edit entries in place and never add or remove any, so another length is not data
 * they wrote (and they could not show it). Relax this when the controls can resize the palette.
 * Driven by the defaults' shape, so a new config leaf is restored without code here. Values are not range-checked:
 * stored settings normally come from the library's own controls.
 */
export function restoreConfig(stored: unknown): MindmapConfig {
  if (stored === undefined) return DEFAULT_CONFIG;
  const config = restoreValue(DEFAULT_CONFIG, stored) as MindmapConfig;
  // WHY whole-section fallback: `layout.type` selects which fields exist. With one variant, an unknown type means
  // the stored layout is not ours. A second variant needs per-type defaults here (see the NOTE in layoutConfig.ts).
  if (!isLayoutType(config.layout.type)) return { ...config, layout: DEFAULT_LAYOUT_CONFIG };
  // String unions are restored by type only above; an unknown value would reach the layout as a side order.
  if (!isSideOrder(config.layout.sideOrder)) return { ...config, layout: { ...config.layout, sideOrder: DEFAULT_LAYOUT_CONFIG.sideOrder } };
  return config;
}

function restoreValue(fallback: unknown, stored: unknown): unknown {
  if (Array.isArray(fallback)) {
    // Entries go through `restoreValue` too, so keys the config does not have are dropped inside arrays as well.
    return isWellFormedArray(fallback, stored) ? stored.map((entry, index) => restoreValue(fallback[index], entry)) : fallback;
  }
  if (isPlainObject(fallback)) {
    if (!isPlainObject(stored)) return fallback;
    return Object.fromEntries(Object.entries(fallback).map(([key, value]) => [key, restoreValue(value, stored[key])]));
  }
  return isSameKindOfLeaf(fallback, stored) ? stored : fallback;
}

/** Entries are checked against the default's entry at the same index (config arrays are uniform anyway). */
function isWellFormedArray(fallback: readonly unknown[], stored: unknown): stored is readonly unknown[] {
  return Array.isArray(stored) && stored.length === fallback.length && stored.every((entry, index) => conforms(fallback[index], entry));
}

function conforms(template: unknown, value: unknown): boolean {
  if (Array.isArray(template)) return isWellFormedArray(template, value);
  if (isPlainObject(template)) {
    return isPlainObject(value) && Object.entries(template).every(([key, item]) => conforms(item, value[key]));
  }
  return isSameKindOfLeaf(template, value);
}

function isSameKindOfLeaf(template: unknown, value: unknown): boolean {
  if (typeof template === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === typeof template;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
