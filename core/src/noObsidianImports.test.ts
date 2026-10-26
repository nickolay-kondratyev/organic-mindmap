import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the package seam: nothing under `core/` (library, demo, E2E, bench, test support) imports `obsidian`.
 * The Obsidian-specific code lives in `obsidian-plugin/`, which depends on this package, never the reverse.
 */
const CORE_PACKAGE_DIR = join(__dirname, '..');
/** Installed or generated trees, not sources. */
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'dist-demo', 'coverage', 'test-results', 'playwright-report']);
const OBSIDIAN_IMPORT = /from\s+['"]obsidian(\/|['"])|require\(\s*['"]obsidian|import\(\s*['"]obsidian/;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return SKIPPED_DIRS.has(entry) ? [] : listSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

describe('the core package', () => {
  it('GIVEN every source file under core/ WHEN scanning imports THEN none import obsidian', () => {
    const offenders = listSourceFiles(CORE_PACKAGE_DIR).filter((file) =>
      OBSIDIAN_IMPORT.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
