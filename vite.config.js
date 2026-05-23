import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative paths for assets on GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: true
  }
});
