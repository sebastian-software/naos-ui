import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  javaScriptPackages,
  nativeReleaseMatrix,
  nativeTargets,
  publicPackages,
} from "./release-set.mjs"
import { validateReleaseSet } from "./check-release-set.mjs"

const rootDir = fileURLToPath(new URL("..", import.meta.url))

test("release inventory has unique packages and complete native matrix entries", () => {
  assert.equal(javaScriptPackages.length, 15)
  assert.equal(nativeTargets.length, 8)
  assert.equal(publicPackages.length, 23)
  assert.equal(new Set(publicPackages.map(({ name }) => name)).size, publicPackages.length)
  assert.equal(new Set(publicPackages.map(({ path }) => path)).size, publicPackages.length)
  assert.deepEqual(
    nativeReleaseMatrix.map(({ package: packageName }) => packageName),
    nativeTargets.map(({ name }) => name),
  )
})

test("release validation rejects a workflow that bypasses the JavaScript inventory", () => {
  const errors = validateReleaseSet({
    rootDir,
    readText: (path) => {
      const content = readFileSync(path, "utf8")
      return path.endsWith(".github/workflows/release.yml")
        ? content.replace("node scripts/release-set.mjs --js-paths", "printf 'packages/core\\n'")
        : content
    },
  })

  assert.ok(errors.some((error) => error.includes("JavaScript publish loop")))
})

test("release validation rejects stale generated publishing documentation", () => {
  const errors = validateReleaseSet({
    rootDir,
    readText: (path) => {
      const content = readFileSync(path, "utf8")
      return path.endsWith("docs/npm-publishing.md")
        ? content.replace("@naos-ui/data", "@naos-ui/not-data")
        : content
    },
  })

  assert.ok(errors.some((error) => error.includes("generated package table")))
})

test("release validation rejects a release-please package mismatch", () => {
  const errors = validateReleaseSet({
    rootDir,
    readText: (path) => {
      const content = readFileSync(path, "utf8")
      if (!path.endsWith("release-please-config.json")) {
        return content
      }
      const config = JSON.parse(content)
      delete config.packages["packages/data"]
      return JSON.stringify(config)
    },
  })

  assert.ok(errors.some((error) => error.includes("release-please packages")))
})
