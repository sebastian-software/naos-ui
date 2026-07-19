// Installs a prebuilt native compiler binding so JS-only contributors can run
// the TypeScript packages without a Rust toolchain. Sources, in order:
//
//   1. `--from <path>`: a local `naos-node.node` or a platform-package `.tgz`.
//   2. The published npm platform package (once releases are on npm).
//   3. The latest `native-binding-<OS>` artifact from CI, via the GitHub CLI.
//
// The installed binding matches its source release or CI run, not necessarily
// the Rust sources at HEAD — compiler contributors still need
// `pnpm build:native`.
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repoSlug = "sebastian-software/naos-ui"

function currentNativePackage() {
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "compiler-darwin-arm64" : "compiler-darwin-x64"
  }
  if (process.platform === "win32") {
    return process.arch === "arm64" ? "compiler-win32-arm64-msvc" : "compiler-win32-x64-msvc"
  }
  if (process.platform === "linux") {
    const isGnu = typeof process.report?.getReport?.().header?.glibcVersionRuntime === "string"
    const libc = isGnu ? "gnu" : "musl"
    return process.arch === "arm64" ? `compiler-linux-arm64-${libc}` : `compiler-linux-x64-${libc}`
  }
  throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`)
}

function artifactName() {
  if (process.platform === "darwin") return "native-binding-macOS"
  if (process.platform === "win32") return "native-binding-Windows"
  return "native-binding-Linux"
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options })
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit ${code}`}`))
    })
  })
}

async function findBinding(dir) {
  for (const entry of await readdir(dir, { recursive: true })) {
    if (basename(entry) === "naos-node.node") {
      return join(dir, entry)
    }
  }
  return null
}

async function bindingFromLocal(source, workspace) {
  if (source.endsWith(".node")) {
    return source
  }
  await run("tar", ["-xzf", source, "-C", workspace])
  return findBinding(workspace)
}

async function bindingFromNpm(packageName, workspace) {
  console.log(`[fetch-native] trying ${packageName}@latest from npm`)
  await run("npm", ["pack", `${packageName}@latest`, "--pack-destination", workspace])
  const tarball = (await readdir(workspace)).find((file) => file.endsWith(".tgz"))
  if (!tarball) return null
  await run("tar", ["-xzf", join(workspace, tarball), "-C", workspace])
  return findBinding(workspace)
}

function runCapture(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "inherit"] })
    let stdout = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise(stdout)
        return
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit ${code}`}`))
    })
  })
}

async function bindingFromCiArtifact(workspace) {
  const name = artifactName()
  console.log(`[fetch-native] trying CI artifact ${name} via GitHub CLI`)
  // Pin to the latest successful CI run on main so a PR-branch artifact can
  // never shadow the mainline binding.
  const runsJson = await runCapture("gh", [
    "run",
    "list",
    "--repo",
    repoSlug,
    "--branch",
    "main",
    "--workflow",
    "CI",
    "--status",
    "success",
    "--limit",
    "1",
    "--json",
    "databaseId",
  ])
  const runId = JSON.parse(runsJson)[0]?.databaseId
  if (!runId) {
    throw new Error("No successful CI run found on main.")
  }
  await run("gh", [
    "run",
    "download",
    String(runId),
    "--repo",
    repoSlug,
    "--name",
    name,
    "--dir",
    join(workspace, "artifact"),
  ])
  return findBinding(join(workspace, "artifact"))
}

const fromIndex = process.argv.indexOf("--from")
const fromSource = fromIndex === -1 ? null : process.argv[fromIndex + 1]
if (fromIndex !== -1 && !fromSource) {
  throw new Error("--from requires a path to a naos-node.node file or a platform-package .tgz.")
}
const packageDir = currentNativePackage()
const workspace = await mkdtemp(join(tmpdir(), "naos-native-binding-"))

try {
  let binding = null
  if (fromSource) {
    binding = await bindingFromLocal(resolve(fromSource), workspace)
  } else {
    binding = await bindingFromNpm(`@naos-ui/${packageDir}`, workspace).catch(() => null)
    if (!binding) {
      binding = await bindingFromCiArtifact(workspace).catch(() => null)
    }
  }
  if (!binding) {
    throw new Error(
      [
        "No prebuilt binding source worked. Options:",
        "  - authenticate the GitHub CLI (`gh auth login`) and retry for CI artifacts,",
        "  - pass `--from <naos-node.node | platform-package.tgz>`,",
        "  - or build locally with a Rust toolchain: `pnpm build:native`.",
      ].join("\n"),
    )
  }

  const targets = [join(root, "packages", "compiler", "native", "naos-node.node")]
  // The native loader prefers the platform package when its directory exists,
  // so keep both copies in sync (mirrors scripts/copy-native-binding.mjs).
  const platformDir = join(root, "packages", packageDir)
  if (existsSync(platformDir)) {
    targets.push(join(platformDir, "naos-node.node"))
  }
  for (const target of targets) {
    await mkdir(dirname(target), { recursive: true })
    await copyFile(binding, target)
    console.log(`[fetch-native] installed ${target}`)
  }
  console.log(
    "[fetch-native] done. The binding matches its source release or CI run; compiler work still needs `pnpm build:native`.",
  )
} finally {
  await rm(workspace, { force: true, recursive: true })
}
