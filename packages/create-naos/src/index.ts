import { cp, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export type NaosScaffoldResult = {
  readonly projectName: string
  readonly targetDir: string
}

/**
 * Copies the starter template into `targetDir`, names the project after the
 * directory, and renames `_gitignore` to `.gitignore`. The target directory
 * must be empty or absent.
 */
export async function scaffoldNaosProject(targetDir: string): Promise<NaosScaffoldResult> {
  const resolvedTarget = resolve(targetDir)
  const projectName = toPackageName(basename(resolvedTarget))

  const existing = await readdir(resolvedTarget).catch(() => null)
  if (existing !== null && existing.length > 0) {
    throw new Error(`Target directory "${resolvedTarget}" already exists and is not empty.`)
  }

  await mkdir(resolvedTarget, { recursive: true })
  await cp(templateDir(), resolvedTarget, { recursive: true })
  // npm strips .gitignore from published packages, so the template ships it
  // under a placeholder name.
  await rename(join(resolvedTarget, "_gitignore"), join(resolvedTarget, ".gitignore"))

  const packageJsonPath = join(resolvedTarget, "package.json")
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as Record<string, unknown>
  packageJson.name = projectName
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

  return { projectName, targetDir: resolvedTarget }
}

function templateDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "template")
}

function toPackageName(directoryName: string): string {
  const name = directoryName
    .toLowerCase()
    .replaceAll(/[^a-z0-9-_.]+/gu, "-")
    // npm rejects names starting with a dot or underscore.
    .replaceAll(/^[-_.]+|[-_.]+$/gu, "")
  return name || "naos-app"
}
