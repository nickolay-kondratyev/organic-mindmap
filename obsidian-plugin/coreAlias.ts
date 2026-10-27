import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * The plugin imports the library by its published name `organic-mindmap` but resolves it to the core
 * package's SOURCE entry (tsconfig `paths`, esbuild and Vitest all use this one table).
 * WHY-NOT the built `core/dist/`: typecheck, bundle and tests would then depend on a prior `npm run build -w core`
 * and silently use a stale build after a core edit. Only the public entry is aliased, so the plugin still
 * cannot reach core internals. Mirrors the library's `exports` (core/package.json): the public entry, its
 * bundled font subpath and its stylesheet (imported by `styles.css`).
 */
export const CORE_ALIAS = {
  'organic-mindmap': path.join(PACKAGE_ROOT, '../core/src/index.ts'),
  'organic-mindmap/fonts/kalam-latin-400-normal.ttf': path.join(PACKAGE_ROOT, '../core/assets/fonts/kalam/latin-400-normal.ttf'),
  'organic-mindmap/styles.css': path.join(PACKAGE_ROOT, '../core/assets/organic-mindmap.css'),
};
