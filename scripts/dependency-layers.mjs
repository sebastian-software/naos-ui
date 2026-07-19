import { javaScriptPackages } from "./release-set.mjs"

const freeze = (values) => Object.freeze(values)

export const foundationPackageNames = freeze([
  "@naos-ui/core",
  "@naos-ui/runtime",
  "@naos-ui/motion",
  "@naos-ui/data",
  "@naos-ui/actions",
  "@naos-ui/compiler",
])

export const outwardPackageNames = freeze([
  "@naos-ui/primitives",
  "@naos-ui/testing",
  "@naos-ui/router",
  "@naos-ui/vite",
  "@naos-ui/unplugin",
  "@naos-ui/cli",
  "@naos-ui/data-convex",
  "create-naos",
])

export const dependencyFields = freeze([
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "devDependencies",
])

const foundationPackageNameSet = new Set(foundationPackageNames)
const outwardPackageNameSet = new Set(outwardPackageNames)

export const dependencyBoundaryMessage = "Foundation packages cannot import outward Naos layers."

export const foundationSourceGlobs = freeze([
  ...javaScriptPackages
    .filter(({ name }) => classifyPackageName(name) === "foundation")
    .map(({ path }) => `${path}/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}`),
  "scripts/fixtures/dependency-boundaries/packages/core/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
])

export function classifyPackageName(packageName) {
  const layers = packageLayers(packageName)
  return layers.length === 1 ? layers[0] : undefined
}

export function packageLayers(packageName) {
  const layers = []
  if (foundationPackageNameSet.has(packageName) || packageName.startsWith("@naos-ui/compiler-")) {
    layers.push("foundation")
  }
  if (outwardPackageNameSet.has(packageName)) {
    layers.push("outward")
  }
  return layers
}

export function packageNameFromSpecifier(specifier) {
  if (!specifier.startsWith("@naos-ui/")) {
    return undefined
  }

  return specifier.split("/").slice(0, 2).join("/")
}
