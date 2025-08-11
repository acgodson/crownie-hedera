import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/content.ts'),
      name: 'CrownieContent',
      fileName: 'content',
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        globals: {
          // Add any global dependencies here if needed
        }
      }
    },
    target: 'esnext',
    minify: 'esbuild'
  }
}); 