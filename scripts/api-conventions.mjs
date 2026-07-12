import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export const frameworkPublicEntryPoints = Object.freeze([
  "packages/data/src/index.ts",
  "packages/data-convex/src/index.ts",
  "packages/motion/src/index.ts",
  "packages/router/src/index.ts",
])

const publicTypePattern = /^export\s+(type|interface|class|enum)\s+([A-Za-z_$][\w$]*)/gm
const legacyGenericValuePattern = /^export\s+(?:const|let|var)\s+(defaultResourceCache)\b/gm

export function validatePublicApiSource(path, source) {
  const violations = []

  for (const match of source.matchAll(publicTypePattern)) {
    const [, kind, name] = match
    if (!name.startsWith("Naos")) {
      violations.push({ kind, name, path })
    }
  }

  for (const match of source.matchAll(legacyGenericValuePattern)) {
    violations.push({ kind: "value", name: match[1], path })
  }

  return violations
}

export function validateFrameworkPublicApis(
  readSource = (path) => readFileSync(resolve(rootDir, path), "utf8")
) {
  return frameworkPublicEntryPoints.flatMap((path) =>
    validatePublicApiSource(path, readSource(path))
  )
}

export function formatPublicApiConventionViolation({ kind, name, path }) {
  return [
    "Public API naming violation:",
    `  file: ${path}`,
    `  ${kind}: ${name}`,
    "  rule: public framework types and generic singleton values use the Naos prefix",
  ].join("\n")
}
