import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  discoverPublicPackages,
  formatDependencyBoundaryViolation,
  runDependencyBoundaryCheck,
  validateDependencyBoundaries,
} from "./check-dependency-boundaries.mjs"
import { dependencyBoundaryMessage } from "./dependency-layers.mjs"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixturePath = "scripts/fixtures/dependency-boundaries/packages/core/src/forbidden.ts"

test("the current workspace respects dependency boundaries", () => {
  assert.deepEqual(validateDependencyBoundaries(discoverPublicPackages()), [])
})

test("manifest validation rejects every dependency field deterministically", () => {
  const packages = [
    {
      manifest: {
        name: "@naos-ui/core",
        dependencies: { "@naos-ui/vite": "workspace:*" },
        optionalDependencies: { "@naos-ui/router": "workspace:*" },
        peerDependencies: { "@naos-ui/primitives": "workspace:*" },
        devDependencies: { "@naos-ui/data-convex": "workspace:*" },
      },
      path: "packages/core",
    },
  ]

  assert.deepEqual(
    validateDependencyBoundaries(packages).map(formatDependencyBoundaryViolation),
    [
      "Dependency boundary violation:\n  package: @naos-ui/core\n  field: dependencies\n  target: @naos-ui/vite\n  rule: foundation packages cannot depend on outward layers",
      "Dependency boundary violation:\n  package: @naos-ui/core\n  field: devDependencies\n  target: @naos-ui/data-convex\n  rule: foundation packages cannot depend on outward layers",
      "Dependency boundary violation:\n  package: @naos-ui/core\n  field: optionalDependencies\n  target: @naos-ui/router\n  rule: foundation packages cannot depend on outward layers",
      "Dependency boundary violation:\n  package: @naos-ui/core\n  field: peerDependencies\n  target: @naos-ui/primitives\n  rule: foundation packages cannot depend on outward layers",
    ]
  )
})

test("manifest validation rejects an unclassified public package", () => {
  const [violation] = validateDependencyBoundaries([
    {
      manifest: { name: "@naos-ui/new-package" },
      path: "packages/new-package",
    },
  ])

  assert.equal(
    formatDependencyBoundaryViolation(violation),
    "Dependency layer classification invalid:\n  package: @naos-ui/new-package\n  path: packages/new-package\n  layers: none\n  rule: every published @naos-ui package must belong to exactly one layer"
  )
})

test("the manifest check exits non-zero and reports every violation", () => {
  const messages = []
  const exitCode = runDependencyBoundaryCheck({
    packages: [
      {
        manifest: {
          name: "@naos-ui/runtime",
          dependencies: { "@naos-ui/router": "workspace:*" },
        },
        path: "packages/runtime",
      },
    ],
    report: (message) => messages.push(message),
  })

  assert.equal(exitCode, 1)
  assert.deepEqual(messages, [
    "Dependency boundary violation:\n  package: @naos-ui/runtime\n  field: dependencies\n  target: @naos-ui/router\n  rule: foundation packages cannot depend on outward layers",
  ])
})

test("Oxlint rejects an outward import from a foundation fixture", () => {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
  const environment = { ...process.env }
  delete environment.GITHUB_ACTIONS
  const result = spawnSync(command, ["exec", "oxlint", "--no-ignore", fixturePath], {
    cwd: rootDir,
    encoding: "utf8",
    env: environment,
  })
  const output = `${result.stdout}\n${result.stderr}`

  assert.notEqual(result.status, 0, output)
  assert.match(output, /no-restricted-imports/)
  assert.match(output, /@naos-ui\/router/)
  assert.match(output, new RegExp(dependencyBoundaryMessage.replaceAll(".", "\\.")))
})
