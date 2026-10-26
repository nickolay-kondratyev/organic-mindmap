// Obsidian's usual esbuild setup: one CommonJS bundle `main.js` with `obsidian`, Electron and Node built-ins
// left external (Obsidian provides them at runtime). React is not bundled: the plugin mounts the core's
// framework-free `mountMindmap`.
import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Node strips the types from this .ts import at runtime (Node >= 22.6); one alias table for tsconfig, esbuild and Vitest.
import { CORE_ALIAS } from './coreAlias.ts';

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const context = await esbuild.context({
  entryPoints: [path.join(PACKAGE_ROOT, 'src/main.ts')],
  outfile: path.join(PACKAGE_ROOT, 'main.js'),
  bundle: true,
  format: 'cjs',
  target: 'es2022',
  platform: 'browser',
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  treeShaking: true,
  alias: CORE_ALIAS,
  // The bundled Kalam font (src/mapView/bundledFonts.ts): no CDN fetch from inside Obsidian.
  loader: { '.ttf': 'binary' },
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
