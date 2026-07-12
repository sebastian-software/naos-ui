import { dirname, relative } from "node:path"

import type { NaosPackageContext } from "./package-context.js"
import { NaosCompilerError } from "./index.js"

export type NaosManifestPackage = {
  name: string
  version: string | null
  tagPrefix: string
}

export type NaosManifestComponent = {
  tagName: string
  className: string
  exportName?: string | null
  importPath: string
  shadow: boolean
  usesDeclarativeShadowDom: boolean
}

export type NaosManifest = {
  schemaVersion: 1
  package: NaosManifestPackage
  components: NaosManifestComponent[]
}

export type NaosManifestComponentInput = Omit<NaosManifestComponent, "importPath"> & {
  filename: string
  package: NaosPackageContext
}

export function createNaosManifest(
  entries: readonly NaosManifestComponentInput[]
): NaosManifest {
  const first = entries[0]
  if (!first) throw new Error("Cannot create an Naos manifest without components.")
  const packageRoot = dirname(first.package.packageJsonPath)
  const seen = new Map<string, string>()
  const components = entries.map(({ filename, package: context, ...component }) => {
    if (
      context.name !== first.package.name ||
      context.version !== first.package.version ||
      context.tagPrefix !== first.package.tagPrefix ||
      context.packageJsonPath !== first.package.packageJsonPath
    ) {
      throw manifestDiagnostic(
        "NAOS_MANIFEST_MIXED_PACKAGE_CONTEXT",
        context.packageJsonPath,
        `Cannot mix package contexts in one Naos manifest: ${first.package.packageJsonPath} and ${context.packageJsonPath}.`,
        "Emit one manifest per package root."
      )
    }
    const importPath = normalizePath(relative(packageRoot, filename))
    const previous = seen.get(component.tagName)
    if (previous) {
      throw manifestDiagnostic(
        "NAOS_MANIFEST_DUPLICATE_TAG",
        filename,
        `Duplicate Naos tag <${component.tagName}> in ${previous} and ${importPath}.`,
        "Rename one component or choose a package prefix that produces unique tags."
      )
    }
    seen.set(component.tagName, importPath)
    return {
      className: component.className,
      exportName: component.exportName,
      importPath,
      shadow: component.shadow,
      tagName: component.tagName,
      usesDeclarativeShadowDom: component.usesDeclarativeShadowDom,
    }
  })
  components.sort(
    (left, right) =>
      left.tagName.localeCompare(right.tagName) || left.importPath.localeCompare(right.importPath)
  )
  return {
    schemaVersion: 1,
    package: {
      name: first.package.name,
      version: first.package.version,
      tagPrefix: first.package.tagPrefix,
    },
    components,
  }
}

export function serializeNaosManifest(manifest: NaosManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/")
}

function manifestDiagnostic(
  code: string,
  filename: string,
  message: string,
  hint: string
): NaosCompilerError {
  return new NaosCompilerError(message, [
    { code, filename, hint, message, severity: "error" },
  ])
}
