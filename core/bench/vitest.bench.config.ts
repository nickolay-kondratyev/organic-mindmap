import { defineConfig } from 'vitest/config';
import { SOURCE_ALIASES } from '../vite.shared.ts';

/** Config for `npm run bench` only; `npm test` uses `core/vitest.config.ts`, whose include never matches `*.bench.ts`. */
export default defineConfig({
  resolve: { alias: SOURCE_ALIASES },
  test: {
    globals: true,
    environment: 'node',
    include: ['bench/**/*.bench.ts'],
  },
});
