// Builds the static assets behind the standalone playground site
// (ADR 0025, phase 1):
//
//   1. The `naos-wasm` compiler module for `wasm32-unknown-unknown`.
//   2. Browser-ready ESM copies of @naos-ui/runtime and @naos-ui/motion that
//      generated playground modules import instead of bare package names.
//
// The assets land in sites/playground/public/ so the Vite build ships them
// next to the page. Without a Rust toolchain the wasm step is skipped with a
// warning so JS-only contributors can still build the site; the page then
// reports the missing module at runtime.
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { copyFile, mkdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { installWasmBinding, wasmBindingTarget } from "./build-wasm-binding.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "sites", "playground", "public")

const runtimeAssets = [
  [join(root, "packages", "runtime", "dist", "runtime.mjs"), "naos-runtime/runtime.mjs"],
  [join(root, "packages", "runtime", "dist", "internal.mjs"), "naos-runtime/internal.mjs"],
  [join(root, "packages", "motion", "dist", "index.mjs"), "naos-motion.js"],
]

await mkdir(outDir, { recursive: true })

// Build the two runtime packages here instead of relying on an earlier
// workflow step or a previous local build having produced their dist files.
const packagesBuild = spawnSync(
  "pnpm",
  ["--filter", "@naos-ui/runtime", "--filter", "@naos-ui/motion", "build"],
  { cwd: root, stdio: "inherit" },
)
if (packagesBuild.status !== 0) {
  console.error("[playground] building @naos-ui/runtime and @naos-ui/motion failed.")
  process.exit(1)
}

for (const [source, target] of runtimeAssets) {
  if (!existsSync(source)) {
    console.error(`[playground] missing ${source} after the package build.`)
    process.exit(1)
  }
  const destination = join(outDir, target)
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(source, destination)
  console.log(`[playground] installed ${destination}`)
}

if (await installWasmBinding()) {
  await copyFile(wasmBindingTarget, join(outDir, "naos-compiler.wasm"))
  console.log(`[playground] installed ${join(outDir, "naos-compiler.wasm")}`)
} else {
  console.warn(
    "[playground] wasm module unavailable. The playground page will report it as unavailable.",
  )
}
