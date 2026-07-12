import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  classifyPackageName,
  dependencyFields,
  packageLayers,
  packageNameFromSpecifier,
} from "./dependency-layers.mjs"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export function discoverPublicPackages({
  root = rootDir,
  readDirectory = readdirSync,
  readText = (path) => readFileSync(path, "utf8"),
} = {}) {
  return readDirectory(join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join("packages", entry.name)
      const manifest = JSON.parse(readText(join(root, path, "package.json")))
      return { manifest, path }
    })
    .filter(
      ({ manifest }) =>
        manifest.name?.startsWith("@naos-ui/") && manifest.publishConfig?.access === "public"
    )
}

export function validateDependencyBoundaries(packages) {
  const violations = []

  for (const { manifest, path } of packages) {
    const layers = packageLayers(manifest.name)

    if (layers.length !== 1) {
      violations.push({
        kind: "invalid-classification",
        layers,
        packageName: manifest.name,
        path,
      })
      continue
    }

    if (layers[0] !== "foundation") {
      continue
    }

    for (const field of dependencyFields) {
      for (const target of Object.keys(manifest[field] ?? {})) {
        const targetPackageName = packageNameFromSpecifier(target)
        if (targetPackageName && classifyPackageName(targetPackageName) === "outward") {
          violations.push({
            field,
            kind: "forbidden-dependency",
            packageName: manifest.name,
            target: targetPackageName,
          })
        }
      }
    }
  }

  return violations.sort(compareViolations)
}

export function formatDependencyBoundaryViolation(violation) {
  if (violation.kind === "invalid-classification") {
    return [
      "Dependency layer classification invalid:",
      `  package: ${violation.packageName}`,
      `  path: ${violation.path}`,
      `  layers: ${violation.layers.length === 0 ? "none" : violation.layers.join(", ")}`,
      "  rule: every published @naos-ui package must belong to exactly one layer",
    ].join("\n")
  }

  return [
    "Dependency boundary violation:",
    `  package: ${violation.packageName}`,
    `  field: ${violation.field}`,
    `  target: ${violation.target}`,
    "  rule: foundation packages cannot depend on outward layers",
  ].join("\n")
}

export function runDependencyBoundaryCheck({
  packages = discoverPublicPackages(),
  report = console.error,
} = {}) {
  const violations = validateDependencyBoundaries(packages)

  for (const violation of violations) {
    report(formatDependencyBoundaryViolation(violation))
  }

  return violations.length === 0 ? 0 : 1
}

function compareViolations(left, right) {
  const leftKey = [left.packageName, left.field ?? "", left.target ?? "", left.path ?? ""].join("\0")
  const rightKey = [right.packageName, right.field ?? "", right.target ?? "", right.path ?? ""].join("\0")
  return leftKey.localeCompare(rightKey)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runDependencyBoundaryCheck()
}
