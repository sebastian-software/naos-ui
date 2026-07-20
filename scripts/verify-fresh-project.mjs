import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { publicPackagePaths, publicPackages, javaScriptPackages } from "./release-set.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const args = new Set(process.argv.slice(2))
const keep = args.has("--keep")
const smokePackageName = "naos-fresh-project-smoke"
// The project is scaffolded by create-naos, so the smoke component is the
// starter template's counter.
const smokeTagName = "app-counter"

const thirdPartyVersions = {
  typescript: "^6.0.3",
  vite: "^8.0.16",
}

const workspace = await mkdtemp(join(tmpdir(), "naos-fresh-project-"))
const artifactsDir = join(workspace, "artifacts")
const appDir = join(workspace, "app")

try {
  await phase("build workspace packages", async () => {
    await run("pnpm", ["build"], { cwd: root })
  })

  const tarballs = await phase("pack workspace packages", async () => {
    await mkdir(artifactsDir, { recursive: true })
    const packed = new Map()
    for (const packagePath of publicPackagePaths) {
      const packageJson = JSON.parse(
        await readFile(join(root, packagePath, "package.json"), "utf8"),
      )
      const before = new Set(await files(artifactsDir))
      await run(
        "pnpm",
        ["--dir", join(root, packagePath), "pack", "--pack-destination", artifactsDir],
        { cwd: root },
      )
      const after = await files(artifactsDir)
      const created = after.find((file) => file.endsWith(".tgz") && !before.has(file))
      if (!created) {
        throw new Error(`Could not find tarball created for ${packageJson.name}.`)
      }
      packed.set(packageJson.name, join(artifactsDir, created))
    }
    return packed
  })

  await phase("scaffold project with create-naos", async () => {
    const { scaffoldNaosProject } = await import(
      pathToFileURL(join(root, "packages", "create-naos", "dist", "index.mjs")).href
    )
    await scaffoldNaosProject(appDir)
    await writeVerifierOverlay(appDir, tarballs)
  })

  await phase("install temporary project", async () => {
    await run("pnpm", ["install"], { cwd: appDir })
  })

  await phase("verify native compiler package resolution", async () => {
    await run("node", ["verify-native.mjs"], { cwd: appDir })
  })

  await phase("verify CLI package bin", async () => {
    await run("pnpm", ["exec", "naos", "info", "--json"], { cwd: appDir })
  })

  await phase("build temporary Vite project", async () => {
    await run("pnpm", ["exec", "vite", "build"], { cwd: appDir })
  })

  await phase("inspect Vite output", async () => {
    const assetText = await readBuiltAssets(join(appDir, "dist"))
    assertIncludes(assetText, smokeTagName)
    assertIncludes(assetText, "CustomEvent")
    assertIncludes(assetText, "change")
    assertIncludes(assetText, "data-count")
    assertIncludes(assetText, "naos-button")
    assertIncludes(assetText, "--naos-button-bg")
    const indexHtml = await readFile(join(appDir, "dist", "index.html"), "utf8")
    assertIncludes(indexHtml, smokeTagName)
    assertIncludes(indexHtml, "naos-button")
  })

  console.log(`[fresh-project] ok: temporary project built successfully at ${appDir}`)
  if (!keep) {
    await rm(workspace, { recursive: true, force: true })
  } else {
    console.log(`[fresh-project] kept temporary workspace: ${workspace}`)
  }
} catch (error) {
  console.error(`[fresh-project] failed: ${formatError(error)}`)
  console.error(`[fresh-project] kept temporary workspace for inspection: ${workspace}`)
  process.exitCode = 1
}

async function phase(name, action) {
  console.log(`[fresh-project:${name}] start`)
  try {
    const result = await action()
    console.log(`[fresh-project:${name}] ok`)
    return result
  } catch (error) {
    throw new Error(`${name}: ${formatError(error)}`, { cause: error })
  }
}

async function writeVerifierOverlay(projectDir, tarballs) {
  // The scaffolded template declares registry versions; the verifier pins
  // every public package to the freshly packed tarballs (also enforced via
  // pnpm overrides) and adds the CLI plus the native binding for its extra
  // checks.
  const packageJsonPath = join(projectDir, "package.json")
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"))
  packageJson.name = smokePackageName
  packageJson.dependencies = {
    ...packageJson.dependencies,
    ...Object.fromEntries(
      javaScriptPackages.map(({ name }) => [name, fileSpec(tarballs.get(name))]),
    ),
    [currentNativePackageName()]: fileSpec(tarballs.get(currentNativePackageName())),
    typescript: thirdPartyVersions.typescript,
    vite: thirdPartyVersions.vite,
  }
  delete packageJson.devDependencies
  packageJson.scripts = {
    ...packageJson.scripts,
    "check-native": "node verify-native.mjs",
  }
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

  await writeFile(join(projectDir, "pnpm-workspace.yaml"), pnpmWorkspaceYaml(tarballs))
  await writeFile(
    join(projectDir, "verify-native.mjs"),
    `import { getNativeInfo, transformComponent } from "@naos-ui/compiler"\n\nconst expectedTag = ${JSON.stringify(smokeTagName)}\nconst info = getNativeInfo()\nif (!info || typeof info.coreVersion !== "string") {\n  throw new Error("native compiler info did not expose a coreVersion")\n}\n\nconst source = await import("node:fs/promises").then((fs) => fs.readFile("src/app-counter.wc.tsx", "utf8"))\nconst result = transformComponent({ filename: "src/app-counter.wc.tsx", source })\nconst definition = "__naosDefineComponent(\\\"" + expectedTag + "\\\""\nif (result.tagName !== expectedTag) {\n  throw new Error(\`native compiler transform generated <\${result.tagName}> instead of <\${expectedTag}>\`)\n}\nif (!result.code.includes(definition)) {\n  throw new Error(\`native compiler did not register <\${expectedTag}> through the runtime kernel\`)\n}\n`,
  )
}

function pnpmWorkspaceYaml(tarballs) {
  const overrideLines = publicPackages
    .map(({ name }) => [name, fileSpec(tarballs.get(name))])
    .map(([name, spec]) => `  ${JSON.stringify(name)}: ${JSON.stringify(spec)}`)

  return [
    "packages:",
    "  - .",
    "allowBuilds:",
    "  esbuild: true",
    "overrides:",
    ...overrideLines,
    "",
  ].join("\n")
}

async function readBuiltAssets(distDir) {
  const chunks = []
  for (const file of await recursiveFiles(distDir)) {
    if (file.endsWith(".js")) {
      chunks.push(await readFile(file, "utf8"))
    }
  }
  return chunks.join("\n")
}

async function recursiveFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...(await recursiveFiles(path)))
    } else {
      result.push(path)
    }
  }
  return result
}

async function files(dir) {
  try {
    return await readdir(dir)
  } catch {
    return []
  }
}

function currentNativePackageName() {
  if (process.platform === "darwin") {
    return process.arch === "arm64"
      ? "@naos-ui/compiler-darwin-arm64"
      : "@naos-ui/compiler-darwin-x64"
  }
  if (process.platform === "win32") {
    return process.arch === "arm64"
      ? "@naos-ui/compiler-win32-arm64-msvc"
      : "@naos-ui/compiler-win32-x64-msvc"
  }
  if (process.platform === "linux") {
    const isGnu = typeof process.report?.getReport?.().header?.glibcVersionRuntime === "string"
    const libc = isGnu ? "gnu" : "musl"
    return process.arch === "arm64"
      ? `@naos-ui/compiler-linux-arm64-${libc}`
      : `@naos-ui/compiler-linux-x64-${libc}`
  }
  throw new Error(`Unsupported native smoke-test platform: ${process.platform}/${process.arch}`)
}

function fileSpec(path) {
  if (!path) {
    throw new Error("Missing packed tarball path.")
  }
  return `file:${path}`
}

function assertIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`Expected output to include ${JSON.stringify(expected)}.`)
  }
}

function run(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: "inherit",
    })
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

function formatError(error) {
  return error instanceof Error ? error.message : String(error)
}
