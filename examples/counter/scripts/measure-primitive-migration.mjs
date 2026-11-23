import { resolve } from "node:path"
import { gzipSync } from "node:zlib"

import { build } from "vite"

const installed = (name) =>
  name === "index" ? "@naos-ui/primitives" : `@naos-ui/primitives/${name}`
const built = (directory, name) => resolve(directory, `${name}.mjs`)
const directory = process.argv[2]
const variants = {
  popover: ["popover"],
  select: ["select", "select-item"],
  combined: ["popover", "select", "select-item"],
  all: ["index"],
}
const sizes = {}
const entry = "\0primitive-migration-entry"

for (const [variant, names] of Object.entries(variants)) {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "measure-primitive-consumer",
        resolveId(id) {
          return id === entry ? id : undefined
        },
        load(id) {
          if (id !== entry) return undefined
          return names
            .map(
              (name) =>
                `import ${JSON.stringify(directory ? built(directory, name) : installed(name))}`,
            )
            .join("\n")
        },
      },
    ],
    build: {
      target: "es2022",
      minify: true,
      write: false,
      rolldownOptions: { input: entry },
    },
  })
  const files = (Array.isArray(output) ? output : [output]).flatMap((item) => item.output)
  const chunks = files.filter((item) => item.type === "chunk")
  sizes[variant] = {
    raw: chunks.reduce((size, { code }) => size + Buffer.byteLength(code), 0),
    gzip: chunks.reduce((size, { code }) => size + gzipSync(code).byteLength, 0),
  }
}

console.log(JSON.stringify(sizes, null, 2))
