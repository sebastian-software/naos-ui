import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { publicPackagePaths, publicPackages, javaScriptPackages } from "./release-set.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const args = new Set(process.argv.slice(2))
const keep = args.has("--keep")
const smokePackageName = "naos-fresh-project-smoke"
const smokeTagName = "naos-fresh-project-smoke-smoke-counter"

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
        await readFile(join(root, packagePath, "package.json"), "utf8")
      )
      const before = new Set(await files(artifactsDir))
      await run(
        "pnpm",
        ["--dir", join(root, packagePath), "pack", "--pack-destination", artifactsDir],
        { cwd: root }
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

  await phase("create temporary Vite project", async () => {
    await mkdir(join(appDir, "src"), { recursive: true })
    await writeProjectFiles(appDir, tarballs)
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
    assertMatches(assetText, /new CustomEvent\([`"']change[`"']/)
    assertMatches(assetText, /setAttribute\([`"']data-count[`"']/)
    assertMatches(assetText, /customElements\.define\([`"']naos-button[`"']/)
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

async function writeProjectFiles(projectDir, tarballs) {
  const packageJson = {
    name: smokePackageName,
    private: true,
    type: "module",
    dependencies: {
      ...Object.fromEntries(
        javaScriptPackages.map(({ name }) => [name, fileSpec(tarballs.get(name))])
      ),
      [currentNativePackageName()]: fileSpec(tarballs.get(currentNativePackageName())),
      typescript: thirdPartyVersions.typescript,
      vite: thirdPartyVersions.vite,
    },
    scripts: {
      build: "vite build",
      "check-native": "node verify-native.mjs",
    },
  }

  await writeFile(join(projectDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`)
  await writeFile(join(projectDir, "pnpm-workspace.yaml"), pnpmWorkspaceYaml(tarballs))
  await writeFile(
    join(projectDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          jsxImportSource: "@naos-ui/core",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          target: "ES2022",
          types: ["vite/client"],
        },
        include: ["src", "vite.config.ts"],
      },
      null,
      2
    )}\n`
  )
  await writeFile(
    join(projectDir, "vite.config.ts"),
    `import { defineConfig } from "vite"\nimport { naos } from "@naos-ui/vite"\n\nexport default defineConfig({\n  plugins: [naos()],\n})\n`
  )
  await writeFile(
    join(projectDir, "index.html"),
    `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Naos fresh project smoke</title>\n  </head>\n  <body>\n    <${smokeTagName} label="Smoke"></${smokeTagName}>\n    <naos-button label="Primitive smoke" variant="primary"></naos-button>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n`
  )
  await writeFile(
    join(projectDir, "src", "main.ts"),
    `import "@naos-ui/primitives/button"\nimport "./smoke-counter.wc.tsx"\n\ndocument.addEventListener("change", (event) => {\n  if (event instanceof CustomEvent) {\n    document.body.dataset.lastChange = String(event.detail)\n  }\n})\n`
  )
  await writeFile(
    join(projectDir, "src", "smoke-counter.wc.tsx"),
    `import { event, state } from "@naos-ui/core"\n\nexport type SmokeCounterProps = {\n  label?: string\n}\n\nexport function SmokeCounter({ label = "Smoke" }: SmokeCounterProps = {}) {\n  const count = state(0)\n  const change = event<number>("change")\n\n  return (\n    <button\n      part="button"\n      data-count={count()}\n      aria-label={\`\${label}: \${count()}\`}\n      onClick={() => {\n        count.set(count() + 1)\n        change.emit(count())\n      }}\n    >\n      {\`\${label}: \${count()}\`}\n    </button>\n  )\n}\n`
  )
  await writeFile(
    join(projectDir, "verify-native.mjs"),
    `import { getNativeInfo, transformComponent } from "@naos-ui/compiler"\n\nconst expectedTag = ${JSON.stringify(smokeTagName)}\nconst info = getNativeInfo()\nif (!info || typeof info.coreVersion !== "string") {\n  throw new Error("native compiler info did not expose a coreVersion")\n}\n\nconst source = await import("node:fs/promises").then((fs) => fs.readFile("src/smoke-counter.wc.tsx", "utf8"))\nconst result = transformComponent({ filename: "src/smoke-counter.wc.tsx", source })\nconst definition = "customElements.define(\\\"" + expectedTag + "\\\""\nif (result.tagName !== expectedTag || !result.code.includes(definition)) {\n  throw new Error(\`native compiler transform generated <\${result.tagName}> instead of <\${expectedTag}>\`)\n}\n`
  )
}

function pnpmWorkspaceYaml(tarballs) {
  const overrideLines = publicPackages.map(({ name }) => [name, fileSpec(tarballs.get(name))])
    .map(([name, spec]) => `  ${JSON.stringify(name)}: ${JSON.stringify(spec)}`)

  return ["packages:", "  - .", "allowBuilds:", "  esbuild: true", "overrides:", ...overrideLines, ""].join("\n")
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

function assertMatches(value, expected) {
  if (!expected.test(value)) {
    throw new Error(`Expected output to match ${expected}.`)
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
