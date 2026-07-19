// Builds the static assets behind the docs-site compiler playground
// (ADR 0025, phase 1):
//
//   1. The `naos-wasm` compiler module for `wasm32-unknown-unknown`.
//   2. Browser-ready ESM copies of @naos-ui/runtime and @naos-ui/motion that
//      generated playground modules import instead of bare package names.
//
// Without a Rust toolchain the wasm step is skipped with a warning so
// JS-only contributors can still build the docs; the playground page then
// reports the missing module at runtime.
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { copyFile, mkdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "sites", "docs", "public", "playground")

const runtimeAssets = [
  [join(root, "packages", "runtime", "dist", "runtime.mjs"), "naos-runtime.js"],
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
  await copyFile(source, join(outDir, target))
  console.log(`[playground] installed ${join(outDir, target)}`)
}

const cargoProbe = spawnSync("cargo", ["--version"], { stdio: "ignore" })
if (cargoProbe.error || cargoProbe.status !== 0) {
  console.warn(
    "[playground] cargo not found - skipping the wasm compiler module. The playground page will report it as unavailable.",
  )
  process.exit(0)
}

const build = spawnSync(
  "cargo",
  ["build", "-p", "naos-wasm", "--profile", "wasm-release", "--target", "wasm32-unknown-unknown"],
  { cwd: root, stdio: "inherit" },
)
if (build.status !== 0) {
  console.error(
    "[playground] wasm build failed. If the target is missing, run `rustup target add wasm32-unknown-unknown`.",
  )
  process.exit(1)
}

const wasmArtifact = join(
  root,
  "target",
  "wasm32-unknown-unknown",
  "wasm-release",
  "naos_wasm.wasm",
)
await copyFile(wasmArtifact, join(outDir, "naos-compiler.wasm"))
console.log(`[playground] installed ${join(outDir, "naos-compiler.wasm")}`)
