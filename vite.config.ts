import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error node builtin without @types/node in this config
import path from "node:path";
// @ts-expect-error node builtin without @types/node in this config
import fs from "node:fs";
// @ts-expect-error node builtin without @types/node in this config
import { fileURLToPath } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// @ts-expect-error import.meta.url is available at runtime under ESM
const rootDir = path.dirname(fileURLToPath(import.meta.url));

// pdfjs-dist is a dependency of react-pdf and may be hoisted to the root
// node_modules or left nested under react-pdf. Resolve whichever exists so the
// PDF.js worker can be bundled locally instead of fetched from a CDN.
const pdfjsHoisted = path.resolve(rootDir, "node_modules/pdfjs-dist");
const pdfjsNested = path.resolve(rootDir, "node_modules/react-pdf/node_modules/pdfjs-dist");
const pdfjsDist = fs.existsSync(pdfjsHoisted) ? pdfjsHoisted : pdfjsNested;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "pdfjs-dist": pdfjsDist,
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1422,
    strictPort: true,
    host: host || '127.0.0.1',
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1423,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
