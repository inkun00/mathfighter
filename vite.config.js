import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    hmr: false
  },
  build: {
    outDir: 'dist'
  }
});
