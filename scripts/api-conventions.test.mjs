import assert from "node:assert/strict"
import test from "node:test"
import {
  formatPublicApiConventionViolation,
  validateFrameworkPublicApis,
  validatePublicApiSource,
} from "./api-conventions.mjs"

test("the current framework entry points follow public API naming conventions", () => {
  assert.deepEqual(validateFrameworkPublicApis(), [])
})

test("public type declarations require the Naos prefix", () => {
  const source = [
    "export type NaosState = {}",
    "export interface ResourceState {}",
    "export class ResourceCache {}",
    "export function fetchResource() {}",
  ].join("\n")

  assert.deepEqual(validatePublicApiSource("fixture.ts", source), [
    { kind: "interface", name: "ResourceState", path: "fixture.ts" },
    { kind: "class", name: "ResourceCache", path: "fixture.ts" },
  ])
})

test("the legacy generic default cache name cannot be reintroduced", () => {
  const [violation] = validatePublicApiSource(
    "fixture.ts",
    "export const defaultResourceCache = {}"
  )

  assert.equal(
    formatPublicApiConventionViolation(violation),
    "Public API naming violation:\n  file: fixture.ts\n  value: defaultResourceCache\n  rule: public framework types and generic singleton values use the Naos prefix"
  )
})
