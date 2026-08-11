import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  root: fileURLToPath(new URL("src/renderer", import.meta.url)),
  server: {
    port: 5178,
    strictPort: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "chrome134",
    },
  },
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
    sourcemap: false,
    target: "chrome134",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/monaco-editor")) return "editor";
          if (id.includes("node_modules/@xterm")) return "terminal";
          if (
            id.includes("node_modules/react-markdown") ||
            id.includes("node_modules/remark-")
          ) {
            return "markdown";
          }
        },
      },
    },
  },
});
