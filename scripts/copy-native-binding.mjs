import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
const sourceByPlatform = {
  darwin: "libnaos_node.dylib",
  linux: "libnaos_node.so",
  win32: "naos_node.dll",
}

const sourceFileName = sourceByPlatform[process.platform]
if (!sourceFileName) {
  throw new Error(`Unsupported platform for local native binding copy: ${process.platform}`)
}

const sourcePath = join(rootDir, "target", "debug", sourceFileName)
const targetDir = join(rootDir, "packages", "compiler", "native")
const targetPath = join(targetDir, "naos-node.node")

mkdirSync(targetDir, { recursive: true })
copyFileSync(sourcePath, targetPath)
console.log(`Copied native binding to ${targetPath}`)

// The native loader prefers the platform package over the local dev binding,
// so a stale platform binary from an earlier `pnpm build` would shadow this
// fresh build. Keep the current platform's package binary in sync when its
// directory exists in the workspace.
const platformPackageByTarget = {
  "darwin-arm64": "compiler-darwin-arm64",
  "darwin-x64": "compiler-darwin-x64",
  "linux-arm64": "compiler-linux-arm64-gnu",
  "linux-x64": "compiler-linux-x64-gnu",
  "win32-arm64": "compiler-win32-arm64-msvc",
  "win32-x64": "compiler-win32-x64-msvc",
}
const platformPackage = platformPackageByTarget[`${process.platform}-${process.arch}`]
if (platformPackage) {
  const platformDir = join(rootDir, "packages", platformPackage)
  if (existsSync(platformDir)) {
    const platformPath = join(platformDir, "naos-node.node")
    copyFileSync(sourcePath, platformPath)
    console.log(`Copied native binding to ${platformPath}`)
  }
}
