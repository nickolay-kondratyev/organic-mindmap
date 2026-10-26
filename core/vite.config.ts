import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { DEMO_ROOT, DEV_PORT, PREVIEW_PORT, SOURCE_ALIASES } from './vite.shared.ts';

// Demo app config (`npm run dev` / `npm run build:demo`). The library build is `vite.lib.config.ts`.
export default defineConfig({
  root: DEMO_ROOT,
  plugins: [react()],
  resolve: { alias: SOURCE_ALIASES },
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: PREVIEW_PORT, strictPort: true },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
    // Two pages: the runner UI and the canvas-only reference view the acceptance screenshot targets.
    rollupOptions: { input: { index: path.join(DEMO_ROOT, 'index.html'), reference: path.join(DEMO_ROOT, 'reference.html') } },
  },
});
