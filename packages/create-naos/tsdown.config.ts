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
    bin: "./src/bin.ts",
    index: "./src/index.ts",
  },
  failOnWarn: false,
  format: ["esm", "cjs"],
  platform: "node",
  target: "node22",
})
