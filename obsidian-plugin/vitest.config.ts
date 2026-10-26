import { defineConfig } from 'vitest/config';
import { CORE_ALIAS } from './coreAlias.ts';

export default defineConfig({
  resolve: { alias: CORE_ALIAS },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
