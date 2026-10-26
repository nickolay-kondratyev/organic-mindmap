import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));

export const DEMO_ROOT = path.join(PACKAGE_ROOT, 'demo');

/** Dev server port; override with `PORT=... npm run dev` so parallel checkouts do not collide. */
export const DEV_PORT = portFromEnv('PORT', 5173);
/** Port for `vite preview` and the Playwright web server; override with `E2E_PORT`. */
export const PREVIEW_PORT = portFromEnv('E2E_PORT', 4173);

/**
 * Demo and tests import the library by its published names (`natural-mindmap`, `natural-mindmap/react`)
 * so they can only use the public API (spec D1). Longer alias first so `/react` is not swallowed by the bare name.
 */
export const SOURCE_ALIASES = [
  { find: 'natural-mindmap/react', replacement: path.join(PACKAGE_ROOT, 'src/react/index.ts') },
  { find: 'natural-mindmap', replacement: path.join(PACKAGE_ROOT, 'src/index.ts') },
];

function portFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) throw new Error(`Env ${name}=[${raw}] is not a port number`);
  return parsed;
}
