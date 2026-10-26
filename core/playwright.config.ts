import { defineConfig } from '@playwright/test';
import { PREVIEW_PORT } from './vite.shared.ts';

const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL: BASE_URL },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // Serve the built demo so E2E exercises what `npm run build:demo` ships.
    command: 'npm run build:demo && npm run preview',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
