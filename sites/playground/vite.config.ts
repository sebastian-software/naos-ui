import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

import primitives from "../../packages/primitives/package.json" with { type: "json" }

const base = process.env.NAOS_PLAYGROUND_BASE ?? "/playground/"
const entries: Record<string, string> = {
  runtime: "runtime/dist/runtime.mjs",
  "runtime/internal": "runtime/dist/internal.mjs",
  motion: "motion/dist/index.mjs",
}
for (const [subpath, target] of Object.entries(primitives.exports)) {
  const name = subpath === "." ? "primitives" : "primitives" + subpath.slice(1)
  entries[name] = "primitives/" + target.import.slice(2)
}

export default defineConfig(({ mode }) => {
  if (mode === "preview-modules") {
    return {
      publicDir: false,
      build: {
        outDir: "public/modules",
        emptyOutDir: true,
        lib: {
          entry: Object.fromEntries(
            Object.entries(entries).map(([name, path]) => [
              name,
              fileURLToPath(new URL("../../packages/" + path, import.meta.url)),
            ]),
          ),
          formats: ["es"],
          fileName: (_format: string, name: string) => name + ".js",
        },
      },
    }
  }
  return {
    base,
    plugins: [
      {
        name: "naos-preview-imports",
        transformIndexHtml() {
          const imports = Object.fromEntries(
            Object.keys(entries).map((name) => [
              "@naos-ui/" + name,
              base + "modules/" + name + ".js",
            ]),
          )
          return [
            {
              tag: "script",
              attrs: { type: "importmap" },
              children: JSON.stringify({ imports }),
              injectTo: "head-prepend",
            },
          ]
        },
      },
    ],
  }
})
