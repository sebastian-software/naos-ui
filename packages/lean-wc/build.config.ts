import { defineBuildConfig } from "unbuild"

export default defineBuildConfig({
  entries: ["./src/index", "./src/jsx-runtime", "./src/jsx-dev-runtime", "./src/runtime"],
  declaration: true,
  failOnWarn: false,
  rollup: {
    emitCJS: true,
  },
})
