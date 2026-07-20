// Builds the naos-wasm compiler module for wasm32-unknown-unknown and
// installs it into packages/compiler-wasm/native/ (ADR 0025). The docs
// playground assets reuse the same artifact via build-playground-assets.mjs.
//
// Without a Rust toolchain the build is skipped with a warning so JS-only
// contributors can still run the workspace build; the compiler-wasm package
// then reports the missing module when loaded.
import { spawnSync } from "node:child_process"
import { copyFile, mkdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export const wasmArtifactSource = join(
  root,
  "target",
  "wasm32-unknown-unknown",
  "wasm-release",
  "naos_wasm.wasm",
)
export const wasmBindingTarget = join(
  root,
  "packages",
  "compiler-wasm",
  "native",
  "naos-compiler.wasm",
)

export function buildWasmBinding() {
  const cargoProbe = spawnSync("cargo", ["--version"], { stdio: "ignore" })
  if (cargoProbe.error || cargoProbe.status !== 0) {
    console.warn(
      "[wasm-binding] cargo not found - skipping the wasm compiler build. @naos-ui/compiler-wasm will report the missing module when loaded.",
    )
    return false
  }

  const build = spawnSync(
    "cargo",
    ["build", "-p", "naos-wasm", "--profile", "wasm-release", "--target", "wasm32-unknown-unknown"],
    { cwd: root, stdio: "inherit" },
  )
  if (build.status !== 0) {
    console.error(
      "[wasm-binding] wasm build failed. If the target is missing, run `rustup target add wasm32-unknown-unknown`.",
    )
    process.exit(1)
  }
  return true
}

export async function installWasmBinding() {
  if (!buildWasmBinding()) {
    return false
  }
  await mkdir(dirname(wasmBindingTarget), { recursive: true })
  await copyFile(wasmArtifactSource, wasmBindingTarget)
  console.log(`[wasm-binding] installed ${wasmBindingTarget}`)
  return true
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await installWasmBinding()
}
