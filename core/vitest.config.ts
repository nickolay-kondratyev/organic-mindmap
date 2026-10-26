import { defineConfig } from 'vitest/config';
import { SOURCE_ALIASES } from './vite.shared.ts';

export default defineConfig({
  resolve: { alias: SOURCE_ALIASES },
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'demo/**/*.test.ts'],
    environment: 'node',
    // `npm run coverage`: a report only, no threshold gate.
    coverage: {
      provider: 'v8',
      include: ['src/**', 'demo/**'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'test-support/**'],
    },
  },
});
