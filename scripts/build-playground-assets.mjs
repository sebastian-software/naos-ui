// Build the compiler and the browser module graph used by editable TSX examples.
import { copyFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { installWasmBinding, wasmBindingTarget } from "./build-wasm-binding.mjs"

const outDir = fileURLToPath(new URL("../sites/playground/public/", import.meta.url))
if (!(await installWasmBinding())) {
  throw new Error(
    "The playground requires the Rust compiler and the wasm32-unknown-unknown target.",
  )
}
await mkdir(outDir, { recursive: true })
await copyFile(wasmBindingTarget, join(outDir, "naos-compiler.wasm"))
