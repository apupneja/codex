import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "main/index": "src/main/index.ts",
    "preload/index": "src/preload/index.ts",
  },
  format: ["cjs"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  sourcemap: true,
  clean: false,
  external: ["electron"],
});
