import { transformComponent } from "@lean-wc/core-node"
import { createFilter, type FilterPattern, type Plugin } from "vite"

export type LeanWebComponentsPluginOptions = {
  include?: FilterPattern
  exclude?: FilterPattern
}

export function leanWebComponents(options: LeanWebComponentsPluginOptions = {}): Plugin {
  const filter = createFilter(options.include ?? /\.wc\.tsx$/, options.exclude ?? /node_modules/)

  return {
    name: "lean-wc:transform",
    enforce: "pre",
    transform(code, id) {
      const filename = stripQuery(id)
      if (!filter(filename)) {
        return null
      }

      try {
        const result = transformComponent({
          filename,
          source: code,
        })

        if (!result.hasChanged) {
          return null
        }

        return {
          code: result.code,
          map: null,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.error(`lean-wc transform failed in ${filename}: ${message}`)
      }
    },
  }
}

export default leanWebComponents

function stripQuery(id: string): string {
  return id.split("?")[0] ?? id
}

