import { defineConfig } from "vite";
import * as path from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        content: path.resolve(__dirname, "src/content/content.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "iife",
        manualChunks: undefined,
      },
    },
    target: "esnext",
    minify: false,
  },
  define: {
    global: "globalThis",
  },
});
