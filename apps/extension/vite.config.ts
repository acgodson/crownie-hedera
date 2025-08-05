import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import copy from "rollup-plugin-copy";
import path from "path";

export default defineConfig(({ mode }) => {
  // Get the current file's directory
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  // Go up two levels to reach the project root (where dfx.json is located)
  const projectRoot = path.resolve(__dirname, "../../");

  const env = loadEnv(mode, projectRoot, "");

  return {
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
                // Update paths to match build output
                manifest.background.service_worker = "background.js";
                manifest.content_scripts[0].js = ["content.js"];
                manifest.action.default_popup = "index.html";

                // Keep icon references pointing to logo
                // Icons will use the logo.png from assets

                return JSON.stringify(manifest, null, 2);
              },
            },
          ],
          hook: "writeBundle",
        }),
      ],
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        declarations: fileURLToPath(
          new URL("../../.dfx/local/canisters", import.meta.url)
        ),
      },
      dedupe: ["@dfinity/agent"],
    },
    define: {},
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        // Extension build: Multiple entry points but separate popup/background from content
        input: {
          popup: path.resolve(__dirname, "index.html"),
          background: path.resolve(
            __dirname,
            "src/background/background.ts"
          ),
          content: path.resolve(
            __dirname,
            "src/content/content.ts"
          ),
        },
        output: {
          entryFileNames: (chunk: { name: string; }) => {
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
      minify:  "esbuild",
      copyPublicDir: false, 
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
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
