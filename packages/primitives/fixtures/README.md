# Primitive migration baseline

The snapshot records the 44 public component entries at `1596ab0`, including package exports, manifest records, generated declarations, property defaults and event details, literal parts and slots, CSS hooks, and form association. The SDK candidates for every entry are in the [migration matrix](../../../docs/ui-sdk-primitive-migration.md). The browser fixture records ordered event details and propagation flags for Popover and Select. The [package contract test](../src/public-contract.test.ts) asserts export, manifest, declaration and registration compatibility. Type declaration hashes use SHA-256 after trimming the trailing newline. Part, slot, state and style inventories were captured from the pinned TSX/CSS and reflect literal source declarations. Adapter-generated attributes and runtime behavior need browser coverage.

The existing counter Playwright configuration discovers the companion fixture and runs it in Chromium, Firefox and WebKit. Each fixture test starts on a fresh page with its own registry and event log. For direct comparison with a pinned checkout, use the same test page and fixture entry with that checkout's package registrations, and run it in a separate browser context. The checked-in suite exercises the current build.

## Production bundle baseline

Run `pnpm --filter @naos-ui/example-counter exec node scripts/measure-primitive-migration.mjs` after building primitives. Pass a pinned checkout's `packages/primitives/dist` directory as an optional argument to measure it with the same target, production minifier, and gzip settings. The Select entry includes Select Item. The combined entry imports all three modules and counts shared code once. The all-components entry imports the package root.

| Entry | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Popover | 96,341 | 31,475 |
| Select and Select Item | 107,319 | 33,296 |
| Combined | 146,723 | 44,630 |
| All components | 796,721 | 198,187 |

The post-cutover build measured 57,235 gzip bytes for Popover, 21,613 for Select and Select Item, 65,862 for the combined entry, and 183,875 for all components. Popover plus Select grew by 21,232 bytes (+47.6%). The package root shrank by 14,312 bytes (−7.2%). The selective Popover size reflects the SDK Web registration and overlay behavior, and the root bundles dependencies shared across components once.

## Baseline exceptions

- The historical Select lost its submitted value after disabling and re-enabling an ancestor fieldset. The reproduction and compiler fix are tracked under [#187](https://github.com/sebastian-software/naos-ui/issues/187).
- With the pinned production build, Chromium closed both Popovers on the first Escape. WebKit passed the same probe, and both engines passed the Select probe. The candidate two-Popover fixture verifies single-layer dismissal and focus return under [#188](https://github.com/sebastian-software/naos-ui/issues/188).
- The experimental Firefox run could not launch locally. The CI browser project remains part of the baseline gate under [#186](https://github.com/sebastian-software/naos-ui/issues/186).
