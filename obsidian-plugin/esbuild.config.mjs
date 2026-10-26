// Obsidian's usual esbuild setup: one CommonJS bundle `main.js` with `obsidian`, Electron and Node built-ins
// left external (Obsidian provides them at runtime). React is not bundled: the plugin mounts the core's
// framework-free `mountMindmap`.
// Output is a complete, installable plugin folder `dist/` (main.js + manifest.json + styles.css): link or copy it
// to `<vault>/.obsidian/plugins/organic-mindmap/`.
import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Node strips the types from this .ts import at runtime (Node >= 22.6); one alias table for tsconfig, esbuild and Vitest.
import { CORE_ALIAS } from './coreAlias.ts';

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(PACKAGE_ROOT);
const PLUGIN_DIR = path.join(PACKAGE_ROOT, 'dist');
// manifest.json stays at the repo root (Obsidian's release flow reads it there); styles.css is not imported by code.
const PLUGIN_SIDE_FILES = [path.join(REPO_ROOT, 'manifest.json'), path.join(PACKAGE_ROOT, 'styles.css')];
const watch = process.argv.includes('--watch');

// Copies the side files after every build, so watch mode keeps `dist/` installable.
// Ceiling: in watch mode, editing only styles.css or manifest.json does not trigger a rebuild; save any source file.
const copyPluginSideFiles = {
  name: 'copy-plugin-side-files',
  setup(build) {
    build.onEnd(() => {
      mkdirSync(PLUGIN_DIR, { recursive: true });
      for (const file of PLUGIN_SIDE_FILES) copyFileSync(file, path.join(PLUGIN_DIR, path.basename(file)));
    });
  },
};

const context = await esbuild.context({
  entryPoints: [path.join(PACKAGE_ROOT, 'src/main.ts')],
  outfile: path.join(PLUGIN_DIR, 'main.js'),
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
  plugins: [copyPluginSideFiles],
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
