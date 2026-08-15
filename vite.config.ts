import { defineConfig } from 'vite';

// Chemins relatifs : indispensable pour GitHub Pages (site de projet servi
// depuis /<repo>/ et non depuis la racine du domaine).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: true,
    port: 5173,
  },
});
