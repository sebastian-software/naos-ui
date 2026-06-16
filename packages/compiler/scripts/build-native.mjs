import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const packageDir = process.cwd()
const repoRoot = path.resolve(scriptDir, "../../..")
const packageJson = JSON.parse(
  readFileSync(path.join(packageDir, "package.json"), "utf8")
)

const targets = {
  "@iktia/compiler-darwin-arm64": {
    arch: "arm64",
    platform: "darwin",
    rustTarget: "aarch64-apple-darwin",
  },
  "@iktia/compiler-darwin-x64": {
    arch: "x64",
    platform: "darwin",
    rustTarget: "x86_64-apple-darwin",
  },
  "@iktia/compiler-linux-arm64-gnu": {
    arch: "arm64",
    libc: "gnu",
    platform: "linux",
    rustTarget: "aarch64-unknown-linux-gnu",
  },
  "@iktia/compiler-linux-arm64-musl": {
    arch: "arm64",
    libc: "musl",
    platform: "linux",
    rustTarget: "aarch64-unknown-linux-musl",
  },
  "@iktia/compiler-linux-x64-gnu": {
    arch: "x64",
    libc: "gnu",
    platform: "linux",
    rustTarget: "x86_64-unknown-linux-gnu",
  },
  "@iktia/compiler-linux-x64-musl": {
    arch: "x64",
    libc: "musl",
    platform: "linux",
    rustTarget: "x86_64-unknown-linux-musl",
  },
  "@iktia/compiler-win32-arm64-msvc": {
    arch: "arm64",
    platform: "win32",
    rustTarget: "aarch64-pc-windows-msvc",
  },
  "@iktia/compiler-win32-x64-msvc": {
    arch: "x64",
    platform: "win32",
    rustTarget: "x86_64-pc-windows-msvc",
  },
}

const target = targets[packageJson.name]
if (!target) {
  throw new Error(`Unsupported Iktia native target package: ${packageJson.name}`)
}

const rustTarget = process.env.IKTIA_CARGO_TARGET ?? target.rustTarget
const forcedTarget = Boolean(process.env.IKTIA_CARGO_TARGET)

if (!forcedTarget && (process.platform !== target.platform || process.arch !== target.arch)) {
  console.log(
    `Skipping native build for ${packageJson.name} on ${process.platform}/${process.arch}`
  )
  process.exit(0)
}

if (
  !forcedTarget &&
  target.platform === "linux" &&
  target.libc &&
  detectLinuxLibc() !== target.libc
) {
  console.log(`Skipping native build for ${packageJson.name} due to libc mismatch`)
  process.exit(0)
}

const profile = process.env.IKTIA_RUST_PROFILE === "release" ? "release" : "debug"
const cargoSubcommand =
  process.env.IKTIA_CARGO_SUBCOMMAND ?? (target.libc === "musl" ? "zigbuild" : "build")
const cargoExecutable = process.env.IKTIA_CARGO ?? "cargo"
const cargoArgs = [cargoSubcommand, "--package", "iktia-node", "--target", rustTarget]

if (profile === "release") {
  cargoArgs.push("--release")
}

execFileSync(cargoExecutable, cargoArgs, {
  cwd: repoRoot,
  stdio: "inherit",
})

const binaryName =
  target.platform === "win32"
    ? "iktia_node.dll"
    : `libiktia_node.${target.platform === "darwin" ? "dylib" : "so"}`
const sourcePath = path.join(repoRoot, "target", rustTarget, profile, binaryName)
const targetPath = path.join(packageDir, "iktia-node.node")

if (!existsSync(sourcePath)) {
  throw new Error(`Expected Iktia native binary at ${sourcePath}`)
}

copyFileSync(sourcePath, targetPath)

if (target.platform === "darwin" && process.platform === "darwin") {
  execFileSync("codesign", ["--force", "--sign", "-", "--timestamp=none", targetPath], {
    cwd: packageDir,
    stdio: "inherit",
  })
}

function detectLinuxLibc() {
  const report = process.report?.getReport?.()
  const glibcVersion = report?.header?.glibcVersionRuntime

  if (typeof glibcVersion === "string" && glibcVersion.length > 0) {
    return "gnu"
  }

  return "musl"
}
