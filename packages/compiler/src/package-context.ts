import { existsSync, readFileSync } from "node:fs"
import { dirname, parse, resolve } from "node:path"

import { NaosCompilerError, type NaosDiagnostic } from "./index.js"

export type NaosPackageContext = {
  name: string
  version: string | null
  tagPrefix: string
  packageJsonPath: string
}

export function resolveNaosPackageContext(
  filename: string,
  packageJsonPath?: string
): NaosPackageContext {
  const resolvedPackagePath = packageJsonPath
    ? resolve(packageJsonPath)
    : findNearestPackageJson(resolve(filename))
  if (!resolvedPackagePath) {
    throw packageDiagnostic(
      "NAOS_PACKAGE_FILE_NOT_FOUND",
      filename,
      `No package.json could be found for ${filename}.`,
      "Add a package.json to the owning package or pass packageJsonPath for virtual sources."
    )
  }

  let value: unknown
  try {
    value = JSON.parse(readFileSync(resolvedPackagePath, "utf8"))
  } catch (error) {
    throw packageDiagnostic(
      "NAOS_PACKAGE_FILE_INVALID",
      resolvedPackagePath,
      `Naos could not read a valid package.json: ${error instanceof Error ? error.message : String(error)}.`,
      "Fix the package JSON syntax and make sure the file is readable."
    )
  }
  if (!isRecord(value) || typeof value.name !== "string" || value.name.trim() === "") {
    throw packageDiagnostic(
      "NAOS_PACKAGE_NAME_INVALID",
      resolvedPackagePath,
      "package.json must contain a non-empty string name.",
      "Set package.json name to the stable package identity that owns these components."
    )
  }
  if (value.version !== undefined && typeof value.version !== "string") {
    throw packageDiagnostic(
      "NAOS_PACKAGE_VERSION_INVALID",
      resolvedPackagePath,
      "package.json version must be a string when present.",
      "Use a semantic version string or omit version for an unpublished private app."
    )
  }
  if (value.naos !== undefined && !isRecord(value.naos)) {
    throw packageDiagnostic(
      "NAOS_PACKAGE_CONFIG_INVALID",
      resolvedPackagePath,
      "package.json naos must be an object when present.",
      "Use an object such as { \"naos\": { \"tagPrefix\": \"acme\" } }."
    )
  }

  const configuredPrefix = isRecord(value.naos) ? value.naos.tagPrefix : undefined
  if (configuredPrefix !== undefined && typeof configuredPrefix !== "string") {
    throw packageDiagnostic(
      "NAOS_TAG_PREFIX_INVALID",
      resolvedPackagePath,
      "naos.tagPrefix must be a string.",
      "Use lowercase words separated by single hyphens."
    )
  }
  const tagPrefix = configuredPrefix ?? normalizePackageName(value.name)
  if (!isValidTagPrefix(tagPrefix)) {
    throw packageDiagnostic(
      "NAOS_TAG_PREFIX_INVALID",
      resolvedPackagePath,
      `The resolved tag prefix ${JSON.stringify(tagPrefix)} is invalid or reserved.`,
      "Use lowercase words separated by single hyphens; prefixes starting with xml are reserved."
    )
  }

  return {
    name: value.name,
    packageJsonPath: resolvedPackagePath,
    tagPrefix,
    version: typeof value.version === "string" ? value.version : null,
  }
}

export function normalizePackageName(packageName: string): string {
  return packageName
    .replace(/^@/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function findNearestPackageJson(filename: string): string | null {
  let directory = dirname(filename)
  while (true) {
    const candidate = resolve(directory, "package.json")
    if (existsSync(candidate)) return candidate
    const parent = dirname(directory)
    if (parent === directory || directory === parse(directory).root) return null
    directory = parent
  }
}

function isValidTagPrefix(prefix: string): boolean {
  return !prefix.startsWith("xml") && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(prefix)
}

function packageDiagnostic(
  code: string,
  filename: string,
  message: string,
  hint: string
): NaosCompilerError {
  const diagnostic: NaosDiagnostic = {
    code,
    filename,
    hint,
    message,
    severity: "error",
  }
  return new NaosCompilerError(message, [diagnostic])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
