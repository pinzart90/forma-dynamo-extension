import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  build: {
    sourcemap: true,
  },
  plugins: [preact()],
  server: {
    port: 8081,
  },
  optimizeDeps: {
    exclude: ["forma-embedded-view-sdk"],
  },
});
