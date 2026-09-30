import { defineConfig } from 'vite';

// base './' keeps asset paths relative, which Capacitor and GitHub Pages both need.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
