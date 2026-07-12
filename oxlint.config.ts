import { defineConfig } from "oxlint"
import {
  dependencyBoundaryMessage,
  foundationSourceGlobs,
  outwardPackageNames,
} from "./scripts/dependency-layers.mjs"

export default defineConfig({
  ignorePatterns: [
    "**/dist/**",
    "scripts/fixtures/dependency-boundaries/**",
  ],
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
