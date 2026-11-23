import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

import {
  createNaosManifest,
  renderNaosElementDeclaration,
  serializeNaosManifest,
  transformComponent,
} from "@naos-ui/compiler"
import { springMotionTokenCss } from "@naos-ui/motion"
import ts from "typescript"

const packageRoot = resolve(import.meta.dirname, "..")
const sourceRoot = join(packageRoot, "src")
const distRoot = join(packageRoot, "dist")

const components = [
  "accordion",
  "accordion-item",
  "avatar",
  "button",
  "button-group",
  "checkbox",
  "collapsible",
  "combobox",
  "combobox-item",
  "context-menu",
  "date-picker",
  "dialog",
  "editable",
  "dropdown",
  "field",
  "file-upload",
  "hover-card",
  "listbox",
  "listbox-item",
  "menu",
  "menu-item",
  "number-input",
  "pin-input",
  "popover",
  "progress",
  "radio",
  "radio-group",
  "rating-group",
  "segmented-control",
  "segmented-item",
  "select",
  "select-item",
  "slider",
  "switch",
  "tab",
  "tab-panel",
  "tabs",
  "tags-input",
  "tooltip",
  "toast",
  "toast-root",
  "toggle",
  "toggle-group",
  "toggle-item",
]
const outputs = new Set()
await mkdir(distRoot, { recursive: true })

const exports = []
const manifestEntries = []

await buildHelpers(join(sourceRoot, "internal"), join(distRoot, "internal"))

for (const component of components) {
  const filename = join(sourceRoot, `${component}.wc.tsx`)
  const source = await readFile(filename, "utf8")
  const transformed = transformComponent({ filename, source })
  const code = await inlineCssImports(transpile(transformed.code, filename + ".ts"), filename, {
    motionCss: motionCssForComponentSource(source),
  })
  await emit(join(distRoot, `${component}.mjs`), `${code}\n`)
  await emit(
    join(distRoot, `${component}.d.mts`),
    renderNaosElementDeclaration({
      className: transformed.className,
      exportName: transformed.exportName,
      tagName: transformed.tagName,
      props: transformed.props,
      events: transformed.events,
    }),
  )
  manifestEntries.push({
    className: transformed.className,
    exportName: transformed.exportName,
    filename,
    package: transformed.package,
    shadow: transformed.shadow,
    tagName: transformed.tagName,
    usesDeclarativeShadowDom: false,
  })
  exports.push(component)
}

await emit(
  join(distRoot, "index.mjs"),
  `${exports.map((name) => `export * from "./${name}.mjs"`).join("\n")}\n`,
)
await emit(
  join(distRoot, "naos-manifest.json"),
  serializeNaosManifest(createNaosManifest(manifestEntries)),
)
await emit(
  join(distRoot, "index.d.mts"),
  `${exports.map((name) => `export * from "./${name}.mjs"`).join("\n")}\n`,
)

await prune(distRoot)

async function emit(path, data) {
  const temporary = path + "." + process.pid + ".tmp"
  await writeFile(temporary, data)
  await rename(temporary, path)
  outputs.add(path)
}

async function prune(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await prune(path)
    else if (!outputs.has(path) && !entry.name.endsWith(".tmp")) await rm(path, { force: true })
  }
}

async function inlineCssImports(code, filename, { motionCss = "" } = {}) {
  const cssImport = /import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+["']([^"']+\.css\?inline)["'];?/g
  const sideEffectCssImport = /import\s+["']([^"']+\.css\?inline)["'];?/g
  let output = code
  for (const match of code.matchAll(cssImport)) {
    const [statement, localName, source] = match
    const cssPath = join(dirname(filename), source.replace("?inline", ""))
    const css = appendGeneratedCss(await readFile(cssPath, "utf8"), motionCss)
    output = output.replace(statement, `const ${localName} = ${JSON.stringify(css)};`)
  }
  output = output.replace(sideEffectCssImport, "")
  return output
}

function motionCssForComponentSource(source) {
  if (!source.includes("getNaosPresenceMotionAttributes")) return ""
  return springMotionTokenCss({ kind: "presence", preset: "snappy" })
}

function appendGeneratedCss(css, generatedCss) {
  if (generatedCss === "") return css
  return `${css.trimEnd()}\n\n${generatedCss}\n`
}

async function buildHelpers(sourceDir, outputDir) {
  await mkdir(outputDir, { recursive: true })
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name)
    if (entry.isDirectory()) {
      await buildHelpers(source, join(outputDir, entry.name))
    } else if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith("-probe.ts")
    ) {
      const code = transpile(await readFile(source, "utf8"), source)
      await emit(join(outputDir, entry.name.replace(/\.ts$/, ".js")), code)
    }
  }
}

function transpile(source, filename) {
  return ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
      verbatimModuleSyntax: true,
    },
  }).outputText
}
