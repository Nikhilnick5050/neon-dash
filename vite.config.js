import { defineConfig } from 'vite';

// Relative base so the built game also loads from file:// inside Electron.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 900, // three.js is one big module; that's fine for a desktop game
  },
  server: {
    port: 5173,
  },
});
