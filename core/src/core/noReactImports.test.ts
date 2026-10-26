import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Guards spec L1: the core stays framework-free so it can run and be tested without React. */
const CORE_DIR = join(__dirname);
const REACT_IMPORT = /from\s+['"]react(\/|['"])|require\(\s*['"]react/;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

describe('src/core', () => {
  it('GIVEN every core source file WHEN scanning imports THEN none import React', () => {
    const offenders = listSourceFiles(CORE_DIR).filter((file) => REACT_IMPORT.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
