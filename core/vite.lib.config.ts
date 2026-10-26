import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// Library build: two entry points (framework-free core and the React wrapper) with type declarations.
export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: 'tsconfig.build.json' })],
  build: {
    lib: {
      entry: {
        index: path.resolve(import.meta.dirname, 'src/index.ts'),
        react: path.resolve(import.meta.dirname, 'src/react/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      // Peer/runtime deps stay external so hosts bundle a single copy.
      external: ['react', 'react-dom', 'react/jsx-runtime', 'd3-hierarchy', 'opentype.js'],
    },
    sourcemap: true,
  },
});
