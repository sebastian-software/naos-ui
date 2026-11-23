import { defineConfig } from "oxlint"
import {
  dependencyBoundaryMessage,
  foundationSourceGlobs,
  outwardPackageNames,
} from "./scripts/dependency-layers.mjs"

export default defineConfig({
  ignorePatterns: ["**/dist/**", "crates/naos-core/tests/fixtures/**"],
  overrides: [
    {
      files: foundationSourceGlobs,
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: outwardPackageNames.map((name) => ({
              message: dependencyBoundaryMessage,
              name,
            })),
            patterns: outwardPackageNames.map((name) => ({
              group: [`${name}/*`],
              message: dependencyBoundaryMessage,
            })),
          },
        ],
      },
    },
    {
      files: ["scripts/verify-fresh-project.mjs"],
      rules: {
        "no-useless-escape": "off",
      },
    },
  ],
})
