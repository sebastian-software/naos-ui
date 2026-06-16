import { defineBuildConfig } from "unbuild"

export default defineBuildConfig({
  entries: ["./src/cli"],
  declaration: true,
  failOnWarn: false,
  rollup: {
    emitCJS: true,
  },
})
