import { defineConfig } from "tsup";

export default defineConfig({
  clean: false,
  dts: false,
  entry: {
    "main/index": "src/main/index.ts",
    "preload/index": "src/preload/index.ts",
  },
  external: ["electron"],
  format: ["cjs"],
  minify: true,
  outDir: "dist",
  platform: "node",
  sourcemap: false,
  splitting: false,
  target: "node22",
});
