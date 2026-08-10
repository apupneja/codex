import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  root: "src/renderer",
  server: {
    port: 5178,
    strictPort: true,
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
