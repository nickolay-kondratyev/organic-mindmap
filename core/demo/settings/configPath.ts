/** One step into a config object: a property name, or an index into an array such as the palette. */
export type PathSegment = string | number;
/** Location of one value inside a config object, e.g. `['theme', 'color', 'palette', 0, 'fill']`. */
export type ConfigPath = readonly PathSegment[];

/**
 * Dotted paths of every leaf of `T` whose value is a `V`, e.g. `'branch.taper'` for numbers. Arrays are not
 * descended into, matching how `resolveConfig` treats them as leaves. Used to key per-setting tables so a new
 * config field fails to compile until it has an entry.
 */
export type LeafPathOf<T, V> = {
  [K in keyof T & string]: T[K] extends V
    ? K
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? `${K}.${LeafPathOf<T[K], V>}`
        : never;
}[keyof T & string];

export function dottedPath(path: ConfigPath): string {
  return path.join('.');
}

export class MissingConfigPathError extends Error {
  constructor(path: ConfigPath) {
    super(`No config value at path=[${dottedPath(path)}]`);
    this.name = 'MissingConfigPathError';
  }
}

/** Reads the value at `path`; throws when a step is missing so a typo cannot silently read `undefined`. */
export function valueAt(root: unknown, path: ConfigPath): unknown {
  let current = root;
  for (const segment of path) {
    if (!hasStep(current, segment)) throw new MissingConfigPathError(path);
    current = (current as Record<PathSegment, unknown>)[segment];
  }
  return current;
}

/** Copy of `root` with `value` at `path`; only the objects/arrays along the path are copied, the rest is shared. */
export function withValueAt<T>(root: T, path: ConfigPath, value: unknown): T {
  return replaceAt(root, path, 0, value) as T;
}

function replaceAt(current: unknown, path: ConfigPath, index: number, value: unknown): unknown {
  if (index === path.length) return value;
  const segment = path[index] as PathSegment;
  if (!hasStep(current, segment)) throw new MissingConfigPathError(path);
  const child = replaceAt((current as Record<PathSegment, unknown>)[segment], path, index + 1, value);
  if (Array.isArray(current)) return current.map((item, i) => (i === segment ? child : item));
  return { ...(current as Record<string, unknown>), [segment]: child };
}

function hasStep(current: unknown, segment: PathSegment): boolean {
  if (Array.isArray(current)) return typeof segment === 'number' && segment >= 0 && segment < current.length;
  return typeof current === 'object' && current !== null && typeof segment === 'string' && Object.hasOwn(current, segment);
}
