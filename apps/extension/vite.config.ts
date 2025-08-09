import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import copy from "rollup-plugin-copy";
import path from "path";

export default defineConfig(({ mode }) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const projectRoot = path.resolve(__dirname, "../../");

  const env = loadEnv(mode, projectRoot, "");

  return {
    resolve: {
      alias: {
        // Node.js polyfills for browser environment
        util: 'util',
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer',
        process: 'process/browser',
      }
    },
    plugins: [
      react(),

      ...[
        copy({
          targets: [
            {
              src: path.resolve(__dirname, "src/manifest.json"),
              dest: path.resolve(__dirname, "dist"),
              transform: (contents) => {
                const manifest = JSON.parse(contents.toString());
                manifest.background.service_worker = "background.js";
                manifest.content_scripts[0].js = ["content.js"];
                manifest.action.default_popup = "index.html";
                return JSON.stringify(manifest, null, 2);
              },
            },
            {
              src: path.resolve(__dirname, "src/assets/*"),
              dest: path.resolve(__dirname, "dist/assets"),
            },
          ],
          hook: "writeBundle",
        }),
      ],
    ],
    define: {
      // Provide Node.js globals for browser environment
      'global': 'globalThis',
      'process.env': '{}',
      'process.platform': '"browser"',
      'process.version': '"v16.0.0"',
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: path.resolve(__dirname, "index.html"),
          background: path.resolve(__dirname, "src/background/background.ts"),
          content: path.resolve(__dirname, "src/content/content.ts"),
        },
        output: {
          entryFileNames: (chunk: { name: string }) => {
            if (chunk.name === "background") return "background.js";
            if (chunk.name === "content") return "content.js";
            return "popup.js";
          },
          chunkFileNames: "chunks/[name].[hash].js",
          assetFileNames: "assets/[name].[ext]",
          format: "es",
        },
      },
      target: "esnext",
      minify: "esbuild",
      copyPublicDir: false,
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
          process: '{"env": {}, "platform": "browser", "version": "v16.0.0"}',
          Buffer: "null",
        },
      },
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:4943",
          changeOrigin: true,
        },
      },
    },
  };
});
