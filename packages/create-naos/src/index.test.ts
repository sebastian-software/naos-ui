import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { scaffoldNaosProject } from "./index.js"

let workspace: string | null = null

afterEach(async () => {
  if (workspace) {
    await rm(workspace, { force: true, recursive: true })
    workspace = null
  }
})

describe("scaffoldNaosProject", () => {
  it("copies the template, names the project, and restores .gitignore", async () => {
    workspace = await mkdtemp(join(tmpdir(), "create-naos-"))
    const target = join(workspace, "My Fancy App")

    const result = await scaffoldNaosProject(target)

    expect(result.projectName).toBe("my-fancy-app")
    const files = await readdir(target)
    expect(files).toContain(".gitignore")
    expect(files).not.toContain("_gitignore")
    expect(files).toEqual(
      expect.arrayContaining([
        "index.html",
        "package.json",
        "src",
        "tsconfig.json",
        "vite.config.ts",
      ]),
    )

    const packageJson = JSON.parse(await readFile(join(target, "package.json"), "utf8")) as {
      name: string
      naos: { tagPrefix: string }
      dependencies: Record<string, string>
    }
    expect(packageJson.name).toBe("my-fancy-app")
    expect(packageJson.naos.tagPrefix).toBe("app")
    expect(Object.keys(packageJson.dependencies)).toEqual(
      expect.arrayContaining(["@naos-ui/core", "@naos-ui/primitives"]),
    )

    const tsconfig = await readFile(join(target, "tsconfig.json"), "utf8")
    expect(tsconfig).toContain('"jsxImportSource": "@naos-ui/core"')

    const component = await readFile(join(target, "src", "app-counter.wc.tsx"), "utf8")
    expect(component).toContain("export function AppCounter")
  })

  it("refuses to scaffold into a non-empty directory", async () => {
    workspace = await mkdtemp(join(tmpdir(), "create-naos-"))

    await scaffoldNaosProject(join(workspace, "app"))
    await expect(scaffoldNaosProject(join(workspace, "app"))).rejects.toThrow("not empty")
  })
})
