# RFC 0010 — Migrate Naos primitives to Vercel UI SDK

**Status:** Implemented on the migration branch, 23 November 2026. [Tracker #185](https://github.com/sebastian-software/naos-ui/issues/185) records live progress. This plan replaces the Zag implementation direction in [RFC 0002](0002-zag-backed-primitives-roadmap.md).

## Outcome

Naos authors write TSX and publish package-owned Custom Elements. The public DOM contract belongs to Naos. Vercel UI SDK becomes the shared source of complex interaction behavior inside `@naos-ui/primitives`. A native button, structural field or small Naos composition can stay native. Compiler, core and shared runtime consumers should pay for SDK code only when they import a primitive that uses it.

The [migration matrix](../ui-sdk-primitive-migration.md) allocates all 44 distributed elements, including item and root elements. The [catalogue backlog](../ui-sdk-component-backlog.md) evaluates 55 SDK component guides. Expansion uses its own milestone and can follow the relevant family's port.

Implementation evidence includes the [packaged baseline and measurements](../../packages/primitives/fixtures/README.md), the generated-contract suite for all 44 entries and the counter example’s browser tests.

## Architecture and baseline

Use the Naos 1.1.0 checkout at `1596ab0` and the [experiment results](../../experiments/ui-sdk/README.md) as the reference. Pin compatible SDK Core and Web versions together. Start with the tested 0.1.0-beta.14, or record a newer version and repeat the pilots against it. Choose among documented Core functions, individual Web adapter registrations inside a Naos shadow root, and a small native composition. Keep the SDK's renderer internals outside the dependency boundary. Add shared glue only when a second consumer needs the same behavior.

For each port, identify who owns value, focus, open state, dismissal, native form submission and disposal. A single interaction must have a single owner. Translate SDK events at the Naos boundary, accounting for whether an event reports a proposal or a committed change. Run baseline and candidate pages in separate browser contexts so duplicate global tag registrations cannot mask a failure.

Preserve the current public API by default. If changing a tag, slot, event or value shape would materially simplify Naos, document the old and proposed HTML/TSX, the reason and the consumer impact in that family's issue before merging. The project's early stage makes deliberate changes feasible. Matching every SDK option is outside the migration.

## Work packages and handoff

| Stage | Responsible agent | Delivery and exit |
| --- | --- | --- |
| **M0 · Baseline and form correctness** | Sol owns inventory and fixtures. Terra owns the inherited-disabled regression. | Freeze exported tags/subpaths, declarations, events, slots, parts, CSS states and form value shapes. Reproduce disable → enable with a named Select and fix the generated callback. Both tasks can start immediately. Prove that each documented historical failure is independently observable. |
| **M1 · Two production pilots** | Terra leads Popover and Select in separate PRs. Sol checks public consumers against the baseline. | Popover owns an entire overlay, including modal behavior, nested Escape, focus return, presence and teardown. Select preserves authored rich items, keyboard interaction, native submission/reset and fieldset re-enable. Validate changing props, initial upgrade and reconnect. Measure individual and shared bundles. |
| **M2 · Independent families** | Sol leads native/structural controls, Avatar, Progress, Collapsible and Toggle. Terra leads compound controls; Sol can take bounded checkbox/switch work. | Port each parent together with its public children. Cover Accordion, Tabs, Radio, Segmented Control, Toggle Group, Listbox, Combobox and their input/event contracts. Check the legacy Tabs fallback. Structural controls can meet their gate with their native implementation. |
| **M3 · Overlays and advanced inputs** | Terra leads the layer stack, toast roots, dates, files, sliders and editable inputs. Sol takes bounded input cases and consumer fixtures after M1. | Test menus/context menus, dialogs, tooltip/hover-card and toast in combinations. Prove dates, numbers, files, rating, OTP, free-form tags and edit/submit/cancel semantics. A family PR removes its unused Zag adapter and direct dependency once its last consumer has moved. |
| **M4 · Package cutover** | Sol owns dependency removal, packaging and docs. Terra reviews the cross-family browser and release evidence. | Remove the final machine runner and Zag dependencies from production. Validate the packed root and selective imports in a clean consumer. Release with measured costs and a record of any approved contract changes. |

**Parallel work.** Start M0 fixtures and the fieldset fix together. Popover starts once baseline fixtures exist; Select also needs the fieldset fix to pass its exit gate. Start the simple wave and overlay work after the Popover pilot, compound selection and advanced inputs after both pilots. M3 is a family grouping, so unrelated M2 work can proceed concurrently. A still-Zag component nested inside an SDK overlay must work in the consumer fixture before those releases can ship separately. If it fails, deliver the interacting families in the same release.

**File ownership.** The family lead owns its `.wc.tsx`, CSS, private behavior and focused tests. One integrator coordinates shared edits to `packages/primitives/package.json`, `scripts/build-primitives.mjs` inside that package, root lockfile and CI wiring. Agents can develop independent families in different branches. Rebase against shared package changes before recording the final bundle and browser evidence.

## Tracked work

- **M0** — [#186 Capture the public primitive contracts and browser baselines](https://github.com/sebastian-software/naos-ui/issues/186), [#187 Restore a form control’s value when its enclosing fieldset is re-enabled](https://github.com/sebastian-software/naos-ui/issues/187).
- **M1** — [#188 Port the complete Naos Popover interaction to UI SDK](https://github.com/sebastian-software/naos-ui/issues/188), [#189 Port Naos Select and its authored items to UI SDK](https://github.com/sebastian-software/naos-ui/issues/189).
- **M2** — [#190 Migrate feedback and simple disclosure primitives and verify native controls](https://github.com/sebastian-software/naos-ui/issues/190), [#191 Migrate selection groups, tabs and item collections](https://github.com/sebastian-software/naos-ui/issues/191).
- **M3** — [#192 Migrate dialogs, menus, transient overlays and toast roots](https://github.com/sebastian-software/naos-ui/issues/192), [#193 Migrate date, file, numeric and editable input families](https://github.com/sebastian-software/naos-ui/issues/193).
- **M4** — [#194 Remove production Zag dependencies and verify the packed primitives](https://github.com/sebastian-software/naos-ui/issues/194).
- **Compiler follow-up** — [#195 Diagnose component-local SDK factories that emit an unbound identifier](https://github.com/sebastian-software/naos-ui/issues/195).

[Optional feature milestone](https://github.com/sebastian-software/naos-ui/milestone/3).

## Acceptance and release evidence

1. **Behavior.** Start with current consumers in `examples/counter/tests/counter.spec.ts`. Add focused fixtures for the gaps named in each issue. Verify keyboard and pointer actions, accessible names/roles, slotted children, focus and exact event counts/payloads. For overlays and compound controls, include nested instances, a changing item set and disconnect/reconnect. For form controls inspect actual `FormData`, reset and inherited disabled state.
2. **Rendering and accessibility.** Exercise the browser upgrade path and each supported hydration path. The primitive builder currently emits `usesDeclarativeShadowDom: false`; adding primitive DSD support belongs to a separate decision. Protect compiler DSD behavior already covered by conformance fixtures and #74. For modal, tree or other composite focus changes, include an assistive-technology smoke check and record its result.
3. **Tools and public APIs.** After `pnpm install --frozen-lockfile` and `pnpm build:native`, run the scoped primitive build, type check and tests, including generated declarations and selective imports. The compiler factory capture issue has a working per-instance state pattern. Fix or diagnose silently unbound generated identifiers separately, with a running generated-code fixture.
4. **Browser matrix.** Build the workspace, run `pnpm --filter @naos-ui/example-counter prepare:dsd` and run `pnpm --filter @naos-ui/example-counter exec playwright test --project=<engine>` for chromium, firefox and webkit as in CI. Run the corresponding example-tasks project for downstream regressions. Attach results to the family PR. Transfer required pilot tests into the CI suite; a TODO-marked lab run cannot establish parity.
5. **Final package.** Run `pnpm check`, `pnpm check-native-types`, `pnpm lint`, `pnpm test`, `pnpm verify:fresh-project`, the examples checks, and docs/playground builds on the release candidate. Pack the actual primitives artifact; install it and its dependencies into a fresh consumer, inspect its dependency graph and build a selective and combined import. Check exports, CSS, manifest and types, SSR-safe import, registration, browser interaction and SDK version alignment.
6. **Cost and rollback.** Report raw and gzip sizes for the same production entry points, compressor and target, singly and with shared chunks counted once. The baseline combined Popover/Select comparison was 44,574 vs 73,267 gzip bytes at different parity levels. Explain material deltas and the capabilities they buy. If a published family regresses, restore its previous implementation and lockfile by revert or use the previous package artifact in a fresh page. Continue independent families while repairing the regression.

The exit condition is a coherent public primitives package, green required CI and a Zag-free production graph. Historical baselines may explicitly retain pinned Zag references outside shipped code. Optional component launches have their own acceptance criteria.
