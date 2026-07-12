import {
  formatPublicApiConventionViolation,
  validateFrameworkPublicApis,
} from "./api-conventions.mjs"

const violations = validateFrameworkPublicApis()
for (const violation of violations) {
  console.error(formatPublicApiConventionViolation(violation))
}

if (violations.length > 0) {
  process.exitCode = 1
}
