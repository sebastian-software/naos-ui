import { appendFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const freezeRecord = (record) => Object.freeze(record)

export const javaScriptPackages = Object.freeze([
  freezeRecord({ name: "@naos-ui/core", path: "packages/core" }),
  freezeRecord({ name: "@naos-ui/data", path: "packages/data" }),
  freezeRecord({ name: "@naos-ui/data-convex", path: "packages/data-convex" }),
  freezeRecord({ name: "@naos-ui/motion", path: "packages/motion" }),
  freezeRecord({ name: "@naos-ui/runtime", path: "packages/runtime" }),
  freezeRecord({ name: "@naos-ui/primitives", path: "packages/primitives" }),
  freezeRecord({ name: "@naos-ui/router", path: "packages/router" }),
  freezeRecord({ name: "@naos-ui/testing", path: "packages/testing" }),
  freezeRecord({ name: "@naos-ui/compiler", path: "packages/compiler" }),
  freezeRecord({ name: "@naos-ui/vite", path: "packages/vite" }),
  freezeRecord({ name: "@naos-ui/cli", path: "packages/cli" }),
])

export const nativeTargets = Object.freeze([
  freezeRecord({
    cpu: "x64",
    name: "@naos-ui/compiler-linux-x64-gnu",
    os: "linux",
    path: "packages/compiler-linux-x64-gnu",
    runner: "ubuntu-latest",
    rustTarget: "x86_64-unknown-linux-gnu",
  }),
  freezeRecord({
    cpu: "arm64",
    name: "@naos-ui/compiler-linux-arm64-gnu",
    os: "linux",
    path: "packages/compiler-linux-arm64-gnu",
    runner: "ubuntu-24.04-arm",
    rustTarget: "aarch64-unknown-linux-gnu",
  }),
  freezeRecord({
    cpu: "x64",
    libc: "musl",
    name: "@naos-ui/compiler-linux-x64-musl",
    os: "linux",
    path: "packages/compiler-linux-x64-musl",
    runner: "ubuntu-latest",
    rustTarget: "x86_64-unknown-linux-musl",
  }),
  freezeRecord({
    cpu: "arm64",
    libc: "musl",
    name: "@naos-ui/compiler-linux-arm64-musl",
    os: "linux",
    path: "packages/compiler-linux-arm64-musl",
    runner: "ubuntu-24.04-arm",
    rustTarget: "aarch64-unknown-linux-musl",
  }),
  freezeRecord({
    cpu: "x64",
    name: "@naos-ui/compiler-darwin-x64",
    os: "darwin",
    path: "packages/compiler-darwin-x64",
    runner: "macos-13",
    rustTarget: "x86_64-apple-darwin",
  }),
  freezeRecord({
    cpu: "arm64",
    name: "@naos-ui/compiler-darwin-arm64",
    os: "darwin",
    path: "packages/compiler-darwin-arm64",
    runner: "macos-14",
    rustTarget: "aarch64-apple-darwin",
  }),
  freezeRecord({
    cpu: "x64",
    name: "@naos-ui/compiler-win32-x64-msvc",
    os: "win32",
    path: "packages/compiler-win32-x64-msvc",
    runner: "windows-latest",
    rustTarget: "x86_64-pc-windows-msvc",
  }),
  freezeRecord({
    cpu: "arm64",
    name: "@naos-ui/compiler-win32-arm64-msvc",
    os: "win32",
    path: "packages/compiler-win32-arm64-msvc",
    runner: "windows-11-arm",
    rustTarget: "aarch64-pc-windows-msvc",
  }),
])

export const publicPackages = Object.freeze([...javaScriptPackages, ...nativeTargets])
export const publicPackagePaths = Object.freeze(publicPackages.map(({ path }) => path))
export const javaScriptPackagePaths = Object.freeze(javaScriptPackages.map(({ path }) => path))
export const nativePackageNames = Object.freeze(nativeTargets.map(({ name }) => name))
export const nativeReleaseMatrix = Object.freeze(
  nativeTargets.map(({ name, path, runner, rustTarget }) =>
    freezeRecord({ package: name, path, os: runner, rust_target: rustTarget })
  )
)

export function formatPackageTable() {
  const rows = publicPackages.map(({ name, path }) => `| \`${name}\` | \`${path}\` |`)
  return ["| npm package | Workspace path |", "| --- | --- |", ...rows].join("\n")
}

export function releaseSetUsage() {
  return "Usage: node scripts/release-set.mjs --github-output | --js-paths | --markdown"
}

function runCli(argument) {
  switch (argument) {
    case "--github-output": {
      const outputPath = process.env.GITHUB_OUTPUT
      if (!outputPath) {
        throw new Error("--github-output requires the GITHUB_OUTPUT environment variable.")
      }
      appendFileSync(outputPath, `native_matrix=${JSON.stringify(nativeReleaseMatrix)}\n`)
      return
    }
    case "--js-paths":
      process.stdout.write(`${javaScriptPackagePaths.join("\n")}\n`)
      return
    case "--markdown":
      process.stdout.write(`${formatPackageTable()}\n`)
      return
    default:
      throw new Error(releaseSetUsage())
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    runCli(process.argv[2])
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
