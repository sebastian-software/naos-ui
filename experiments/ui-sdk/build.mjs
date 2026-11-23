import { execFileSync } from "node:child_process"
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { gzipSync } from "node:zlib"
import { fileURLToPath, pathToFileURL } from "node:url"
import { build } from "vite"
import { jumpMarkup, pageMarkup, popoverMarkup, selectMarkup, splitMarkup } from "./fixtures.mjs"

const lab = import.meta.dirname
const repo = resolve(lab, "../..")
const workspace = resolve(process.env.NAOS_BUILD_ROOT ?? repo)
const { naos } = await import(pathToFileURL(join(workspace, "packages/vite/dist/vite.mjs")))
const source = join(workspace, "packages/primitives/src")
const dist = join(lab, "dist")
await mkdir(dist, { recursive: true })

async function stagePopover(variant) {
  const dir = join(lab, "build", variant)
  for (const file of [
    "popover.wc.tsx",
    "popover.wc.css",
    "internal/zag/popover.ts",
    "internal/zag/service.ts",
    "internal/zag/scope.ts",
    "internal/zag/props.ts",
    "internal/behavior/overlay.ts",
    "internal/behavior/presence.ts",
  ]) {
    await mkdir(dirname(join(dir, file)), { recursive: true })
    await copyFile(join(source, file), join(dir, file))
  }
  await copyFile(join(workspace, "packages/primitives/package.json"), join(dir, "package.json"))
  if (variant === "hybrid") {
    await copyFile(join(lab, "dismiss-layer.ts"), join(dir, "dismiss-layer.ts"))
    execFileSync("patch", ["-s", "-p1", "-i", join(lab, "hybrid.patch")], { cwd: dir })
  }
  return join(dir, "popover.wc.tsx")
}

const aliases = {
  "@naos-ui/runtime/internal": join(workspace, "packages/runtime/dist/internal.mjs"),
  "@naos-ui/runtime": join(workspace, "packages/runtime/dist/runtime.mjs"),
  "@naos-ui/motion": join(workspace, "packages/motion/dist/index.mjs"),
  "@naos-ui/core": join(workspace, "packages/core/dist/index.mjs"),
  "@zag-js/popover": join(workspace, "packages/primitives/node_modules/@zag-js/popover"),
}
const entries = {
  sdkSelect: join(lab, "sdk-select.wc.tsx"),
  zagSelect: [
    join(workspace, "packages/primitives/dist/select.mjs"),
    join(workspace, "packages/primitives/dist/select-item.mjs"),
  ],
  baseline: await stagePopover("baseline"),
  hybrid: await stagePopover("hybrid"),
  popover: join(lab, "sdk-popover.wc.tsx"),
  split: join(lab, "split-view.wc.tsx"),
  splitProbe: join(lab, "split-view.wc.tsx"),
  jump: join(lab, "jump-list.wc.tsx"),
  namedSplit: join(lab, "named-split.ts"),
  bareSplit: import.meta.resolve("@ui-sdk/web/resizable"),
}
entries.zagPair = [join(workspace, "packages/primitives/dist/popover.mjs"), ...entries.zagSelect]
entries.sdkPair = [entries.popover, entries.sdkSelect]
const sizes = {}
for (const [name, entry] of Object.entries(entries)) {
  const inputs = [entry]
    .flat()
    .map((path) => (path.startsWith("file:") ? fileURLToPath(path) : path))
  // Bundle exactly what an application gets from importing a registration for its side effects.
  const registration = {
    name: "lab-registration",
    resolveId(id) {
      if (id === "lab:entry") return "\0lab:entry"
    },
    load(id) {
      if (id === "\0lab:entry")
        return inputs.map((path) => "import " + JSON.stringify(path)).join("\n")
    },
  }
  // Diagnostic build only. Test one change to the published hit test without modifying node_modules.
  const pointerProbe = {
    name: "lab-pointer-target",
    transform(code, id) {
      if (!id.endsWith("/components/resizable/resizable-handles.js")) return
      const original = "const top = event.target;"
      if (!code.includes(original)) throw new Error("SDK pointer probe no longer matches")
      return code.replace(original, "const top = event.composedPath()[0];")
    },
  }
  await build({
    root: lab,
    configFile: false,
    logLevel: "warn",
    plugins: [
      registration,
      naos({ prerender: false, manifestFile: false }),
      ...(name === "splitProbe" ? [pointerProbe] : []),
    ],
    resolve: { alias: aliases },
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      outDir: dist,
      emptyOutDir: false,
      minify: true,
      target: "es2022",
      rolldownOptions: {
        input: "lab:entry",
        output: { format: "iife", entryFileNames: name + ".js" },
      },
    },
  })
  const isPopover = ["baseline", "hybrid", "popover"].includes(name)
  const tag = name === "popover" ? "lab-popover" : "naos-popover"
  const markup = isPopover
    ? popoverMarkup(tag, `<${tag} id="inner" label="Open inner">Inner content</${tag}>`)
    : name.endsWith("Select")
      ? selectMarkup(name)
      : name === "jump"
        ? jumpMarkup
        : splitMarkup(name)
  if (!name.endsWith("Pair")) await writeFile(join(dist, name + ".html"), pageMarkup(markup, name))
  const bytes = await readFile(join(dist, name + ".js"))
  sizes[name] = { bytes: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length }
}
console.table(sizes)
await writeFile(join(dist, "sizes.json"), JSON.stringify(sizes, null, 2))
