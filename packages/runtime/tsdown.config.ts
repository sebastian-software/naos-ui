import { defineConfig } from "tsdown/config"

export default defineConfig({
  clean: true,
  deps: {
    skipNodeModulesBundle: true,
  },
  dts: {
    build: true,
    cjsReexport: true,
    tsconfig: "./tsconfig.build.json",
  },
  entry: {
    internal: "./src/internal.ts",
    runtime: "./src/runtime.ts",
  },
  failOnWarn: false,
  fixedExtension: true,
  format: ["esm", "cjs"],
  platform: "browser",
  target: "es2023",
})
