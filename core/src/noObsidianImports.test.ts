import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the package seam: the library (`core/src`, both entry points) and its demo never import `obsidian`.
 * The Obsidian-specific code lives in `obsidian-plugin/`, which depends on this package, never the reverse.
 */
const SCANNED_DIRS = [join(__dirname), join(__dirname, '..', 'demo')];
const OBSIDIAN_IMPORT = /from\s+['"]obsidian(\/|['"])|require\(\s*['"]obsidian/;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

describe('core/src and core/demo', () => {
  it('GIVEN every library and demo source file WHEN scanning imports THEN none import obsidian', () => {
    const offenders = SCANNED_DIRS.flatMap(listSourceFiles).filter((file) =>
      OBSIDIAN_IMPORT.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
