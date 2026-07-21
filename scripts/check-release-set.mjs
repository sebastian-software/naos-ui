import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  formatPackageTable,
  javaScriptPackagePaths,
  nativeTargets,
  publicPackagePaths,
} from "./release-set.mjs"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const documentationStart = "<!-- release-set:start -->"
const documentationEnd = "<!-- release-set:end -->"

export function validateReleaseSet({
  rootDir: validationRoot = rootDir,
  readText = readFile,
} = {}) {
  const errors = []
  const read = (path) => readText(join(validationRoot, path))
  const readJson = (path) => JSON.parse(read(path))
  const packageJsonByPath = new Map(
    publicPackagePaths.map((packagePath) => [
      packagePath,
      readJson(join(packagePath, "package.json")),
    ]),
  )
  const expectedVersion = packageJsonByPath.get("packages/core")?.version
  const rootPackageJson = readJson("package.json")

  check(
    rootPackageJson.version === expectedVersion,
    `root product version must be ${expectedVersion}`,
    errors,
  )

  for (const packagePath of publicPackagePaths) {
    const packageJson = packageJsonByPath.get(packagePath)
    check(
      packageJson?.version === expectedVersion,
      `${packagePath} version must be ${expectedVersion}`,
      errors,
    )
    check(packageJson?.license === "Apache-2.0", `${packagePath} must use Apache-2.0`, errors)
    check(packageJson?.engines?.node === ">=22.0.0", `${packagePath} must require Node 22+`, errors)
    check(
      packageJson?.publishConfig?.access === "public",
      `${packagePath} must publish publicly`,
      errors,
    )
    check(
      packageJson?.repository?.url === "git+https://github.com/sebastian-software/naos-ui.git",
      `${packagePath} repository must point at the GitHub repository`,
      errors,
    )
    check(
      packageJson?.repository?.directory === packagePath,
      `${packagePath} repository directory must match`,
      errors,
    )
    check(
      packageJson?.bugs === "https://github.com/sebastian-software/naos-ui/issues",
      `${packagePath} bugs URL must match`,
      errors,
    )
  }

  for (const packagePath of javaScriptPackagePaths) {
    const packageJson = packageJsonByPath.get(packagePath)
    if (packagePath === "packages/primitives") {
      check(
        packageJson?.scripts?.build === "node scripts/build-primitives.mjs",
        `${packagePath} must build with the primitives compiler script`,
        errors,
      )
    } else if (packagePath === "packages/compiler-wasm") {
      check(
        packageJson?.scripts?.build === "node ../../scripts/build-wasm-binding.mjs && tsdown",
        `${packagePath} must build the wasm binding before tsdown`,
        errors,
      )
      check(
        packageJson?.files?.includes("native/naos-compiler.wasm"),
        `${packagePath} must publish the wasm binding`,
        errors,
      )
    } else {
      check(
        packageJson?.scripts?.build === "tsdown",
        `${packagePath} must build with tsdown`,
        errors,
      )
    }
    check(packageJson?.files?.includes("dist/"), `${packagePath} must publish dist files`, errors)
    check(
      typeof packageJson?.types === "string" &&
        packageJson.types.startsWith("./dist/") &&
        packageJson.types.endsWith(".d.mts"),
      `${packagePath} package-level types must point at dist .d.mts`,
      errors,
    )
    checkExportTypes(packageJson?.exports, packagePath, errors)
  }

  const compilerPackage = packageJsonByPath.get("packages/compiler")
  const optionalDependencyNames = Object.keys(compilerPackage?.optionalDependencies ?? {}).sort()
  check(
    arrayEquals(optionalDependencyNames, nativeTargets.map(({ name }) => name).sort()),
    "@naos-ui/compiler optionalDependencies must match native package matrix",
    errors,
  )

  for (const target of nativeTargets) {
    const packageJson = packageJsonByPath.get(target.path)
    check(
      packageJson?.name === target.name,
      `${target.path} package name must be ${target.name}`,
      errors,
    )
    check(packageJson?.type === "commonjs", `${target.name} must be CommonJS`, errors)
    check(
      packageJson?.main === "./naos-node.node",
      `${target.name} main must point at the .node artifact`,
      errors,
    )
    check(
      packageJson?.os?.[0] === target.os,
      `${target.name} os metadata must be ${target.os}`,
      errors,
    )
    check(
      packageJson?.cpu?.[0] === target.cpu,
      `${target.name} cpu metadata must be ${target.cpu}`,
      errors,
    )
    if (target.libc) {
      check(
        packageJson?.libc?.[0] === target.libc,
        `${target.name} libc metadata must be ${target.libc}`,
        errors,
      )
    }
  }

  const cargoToml = read("Cargo.toml")
  check(
    cargoToml.includes('version = "0.0.0"'),
    "workspace Cargo version must stay aligned",
    errors,
  )
  check(
    read("crates/naos-core/Cargo.toml").includes("publish = false"),
    "naos-core must remain unpublished",
    errors,
  )
  check(
    read("crates/naos-node/Cargo.toml").includes("publish = false"),
    "naos-node must remain unpublished",
    errors,
  )
  check(read(".npmrc").includes("provenance=true"), ".npmrc must enable npm provenance", errors)

  const releasePlease = readJson("release-please-config.json")
  const releasePleasePackages = Object.keys(releasePlease.packages ?? {}).sort()
  check(
    arrayEquals(releasePleasePackages, ["."]),
    "release-please must define exactly one root product release",
    errors,
  )
  check(
    releasePlease["release-type"] === "node",
    "release-please root product must use the node release strategy",
    errors,
  )
  check(
    releasePlease.packages?.["."]?.component === "naos-ui",
    "release-please root component must be naos-ui",
    errors,
  )
  check(
    releasePlease["include-component-in-tag"] === true,
    "release-please product tags must include the naos-ui component",
    errors,
  )
  const releaseVersionFiles = (releasePlease.packages?.["."]?.["extra-files"] ?? [])
    .filter(({ type, jsonpath }) => type === "json" && jsonpath === "$.version")
    .map(({ path }) => path)
    .sort()
  const expectedReleaseVersionFiles = publicPackagePaths
    .map((packagePath) => `${packagePath}/package.json`)
    .sort()
  check(
    arrayEquals(releaseVersionFiles, expectedReleaseVersionFiles),
    "release-please version files must match the public release set",
    errors,
  )

  const releaseWorkflow = read(".github/workflows/release.yml")
  check(
    releaseWorkflow.includes("node-version: 22.18.0"),
    "release workflow must use Node 22.18.0",
    errors,
  )
  check(
    releaseWorkflow.includes("package-manager-cache: false"),
    "release workflow must disable package-manager cache",
    errors,
  )
  check(releaseWorkflow.includes("id-token: write"), "release workflow must allow npm OIDC", errors)
  check(
    releaseWorkflow.includes("startsWith(github.event.release.tag_name, 'naos-ui-v')"),
    "release workflow must publish only coordinated naos-ui releases",
    errors,
  )
  check(
    releaseWorkflow.includes("release-set:"),
    "release workflow must resolve the release inventory",
    errors,
  )
  check(
    releaseWorkflow.includes("node scripts/release-set.mjs --github-output"),
    "release workflow must derive its native matrix from the release inventory",
    errors,
  )
  check(
    releaseWorkflow.includes("fromJSON(needs.release-set.outputs.native_matrix)"),
    "release workflow must consume the generated native matrix",
    errors,
  )
  check(
    releaseWorkflow.includes("node scripts/release-set.mjs --js-paths"),
    "release workflow JavaScript publish loop must consume the release inventory",
    errors,
  )
  check(
    !releaseWorkflow.includes("packages=("),
    "release workflow must not keep a hand-written JavaScript package list",
    errors,
  )

  const runbook = read("docs/npm-publishing.md")
  check(
    extractMarkedBlock(runbook, documentationStart, documentationEnd) === formatPackageTable(),
    "npm publishing runbook generated package table must match the public release set",
    errors,
  )

  const manifest = readJson(".release-please-manifest.json")
  check(
    arrayEquals(Object.keys(manifest), ["."]) && manifest["."] === expectedVersion,
    `release manifest must contain only the root product at ${expectedVersion}`,
    errors,
  )

  return errors
}

function readFile(path) {
  return readFileSync(path, "utf8")
}

function check(condition, message, errors) {
  if (!condition) {
    errors.push(message)
  }
}

function arrayEquals(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function checkExportTypes(exports, packagePath, errors) {
  if (!exports || typeof exports !== "object") {
    errors.push(`${packagePath} must define exports`)
    return
  }

  for (const [exportName, exportValue] of Object.entries(exports)) {
    if (!exportValue || typeof exportValue !== "object" || Array.isArray(exportValue)) {
      errors.push(`${packagePath} export ${exportName} must be an object`)
      continue
    }

    const types = exportValue.types
    check(
      typeof types === "string" && types.startsWith("./dist/") && types.endsWith(".d.mts"),
      `${packagePath} export ${exportName} types must point at dist .d.mts`,
      errors,
    )
  }
}

function extractMarkedBlock(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker)
  const end = text.indexOf(endMarker)
  if (start === -1 || end === -1 || end < start) {
    return undefined
  }
  return text.slice(start + startMarker.length, end).trim()
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errors = validateReleaseSet()
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`release-set: ${error}`)
    }
    process.exitCode = 1
  }
}
