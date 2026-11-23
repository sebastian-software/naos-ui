# Vercel UI SDK experiments for Naos

Tested on 22 November 2026 with Naos 1.1.0 at `1596ab0`, Zag 1.41.2, and the published `@ui-sdk/core` and `@ui-sdk/web` 0.1.0-beta.14. Each interactive experiment builds its own registration bundle and a local HTML demo. Two extra entries measure shared code across a pair of components.

**Historical experiment conclusion.** The initial comparison favored keeping Zag. The subsequent platform assessment selected Vercel UI SDK for its composable behaviors. [Migration plan](../../docs/rfcs/0010-ui-sdk-primitives-migration.md). Vercel can simplify a whole interaction or a self-contained behavior with a clear owner. The keyboard search is a small, working example of keeping TSX authoring and native slots. The SDK popover shows how much interaction code can move out of Naos. The splitter exposes a choice about which components Naos should put inside a shadow root.

To reproduce the historical comparison, set `NAOS_BUILD_ROOT` to a built checkout of Naos at `1596ab0`. The lab reads the original component sources, compiled package and Zag dependencies from that checkout.

## Results

Chromium 148 and WebKit 26.4 produced the same results. Gzip sizes are bytes for one complete browser entry, minified with Vite 8.0.16 targeting ES2022, compressed at level 9. Each entry bundles its dependencies independently. A page using several components can share code.

| Entry and local demo | What the browser did | Gzip bytes |
| --- | --- | ---: |
| [Current Naos popover](dist/baseline.html) | Passed all five popover cases. Uses the repository's component, CSS, Zag service and presence logic. | 31,251 |
| [Naos popover with SDK dismissal](dist/hybrid.html) | Outside press and close button worked. Escape left the settled layer open, including a nested layer and after reconnect. | 32,735 |
| [SDK popover inside Naos TSX](dist/popover.html) | Passed all five cases with an SDK-owned interaction and a Naos event. | 52,113 |
| [Keyboard search in Naos TSX](dist/jump.html) | Typing moved focus across slotted buttons. Accent folding, repeated letters, skipping a disabled button, an inserted button and reconnect worked. | 4,074 |
| [SDK splitter in Naos Shadow DOM](dist/split.html) | Keyboard resizing, collapse, restore and layout events worked. Mouse drag left the panel width unchanged. | 25,645 |
| [Shadow DOM pointer probe](dist/splitProbe.html) | The same splitter also resized by mouse after a one-line change to the SDK pointer hit test. | 25,650 |
| [SDK splitter with project-defined tags](dist/namedSplit.html) | Keyboard, events and drag worked with `lab-panels`, `lab-pane` and `lab-divider` in light DOM. | 22,205 |
| [Stock SDK splitter](dist/bareSplit.html) | The same checks passed with the SDK's own tags in light DOM. | 22,270 |
| [Current Naos/Zag select](dist/zagSelect.html) | Keyboard and mouse selection submitted the intended value and form reset restored the initial value. | 33,255 |
| [SDK select inside Naos TSX](dist/sdkSelect.html) | Passed the same keyboard, mouse, submission and reset checks. | 67,870 |

The five popover cases cover Escape, outside press, close button, nested Escape, and removal while open followed by reconnect. The checks include event counts and focus return on Escape and close. The SDK wrapper implements the tested non-modal slice. The original Naos styling, full public API, modal behavior and DSD hydration were outside this comparison. Development time and accessibility with assistive technology were unmeasured. The registered Playwright Firefox 150 binary timed out starting its content process on this Mac, from both the temporary and standard install paths.

## What changed the decision

**Replacing Zag across the library.** A [69-line SDK select](sdk-select.wc.tsx) reads the consumer's declarative items, lets Vercel own the keyboard and pointer interaction, and uses the Naos host for form participation. The existing select, item and Zag-specific integration total 393 lines excluding CSS and the shared Zag service. The SDK prototype covers a narrower public surface, including only plain item labels. It omits existing styling hooks and open-change events. The line counts bound the size of the example, not the migration savings.

Both controls skipped a disabled option when selecting with the keyboard, submitted the new value via native FormData, and reset the label and submitted value. Both also lost their form value after disabling and re-enabling their enclosing fieldset. Both use the same Naos form-disabled callback, which reflects inherited disabled state onto the host. This finding is common to both implementations.

A single production entry importing both the packaged Naos/Zag popover and select (including the item) measured **44,574 gzip bytes**. The pair of SDK-backed TSX prototypes measured **73,267 gzip bytes** with the same bundler and compression. These are joint builds with shared modules counted once. The published SDK still needed the pointer fix for the shadow-root splitter. Zag also ships a [splitter with keyboard input and panel constraints](https://zagjs.com/components/react/splitter). A portfolio-wide advantage in component coverage or implementation time remains unmeasured.

**Popover.** The [29-line TSX wrapper](sdk-popover.wc.tsx) delegates triggering, closing and focus to the SDK, and translates its event into `naos-open-change`. That trade removes local interaction code at a cost of 20,862 gzip bytes for this standalone entry. The hybrid keeps both layer implementations. In Zag's popover machine, disabling `closeOnEscape` calls `preventDefault()`. Vercel honors that cancellation. An immediate keypress sometimes worked before the deferred listeners attached. Waiting three animation frames after opening exposed the conflict. [Hybrid changes](hybrid.patch) · [Vercel layer implementation](https://github.com/vercel-labs/ui/blob/8060d16d7a9ab3fc79fee25764607344df078c36/packages/core/src/foundation/platform/layers.ts)

**Splitter.** The [Naos component](split-view.wc.tsx) defines two slots, labels the divider and re-emits the layout. Vercel provides sizing constraints, keyboard commands, collapse and dragging. The SDK registers its pointer listener on the document. There, `event.target` is the Naos shadow host, so the SDK's hit test misses the handle. The diagnostic build substitutes `event.composedPath()[0]` at the pointer-down site. Both engines then resized the panel by mouse. That probe establishes the cause for these open shadow roots. Hover hit testing, touch and closed roots need separate verification. A [nine-line registration](named-split.ts) gives a design system its own element names with the published SDK when it controls the light-DOM markup. Placing those tags inside another shadow root would reintroduce the same boundary. [SDK hit-test implementation](https://github.com/vercel-labs/ui/blob/8060d16d7a9ab3fc79fee25764607344df078c36/packages/core/src/components/resizable/resizable-handles.ts)

**Authoring.** The [keyboard search](jump-list.wc.tsx) calls public Core utilities directly and uses ordinary buttons. An initial component-local `const search = createTypeahead()` compiled, but the generated handler referenced an unbound `search`. Giving the SDK instance an explicit Naos lifetime with `state(createTypeahead())` and resetting it on disconnect worked. The SDK wrappers also needed explicit event typing at the Naos JSX boundary. These are concrete places to improve Naos if SDK composition becomes a regular authoring pattern. [Naos compiler boundaries](../../docs/compiler-limitations.md)

## Reproduce

Use a second checkout at `1596ab0` with its workspace dependencies, native compiler and packages built. Run the following in this experiment directory, substituting the absolute path to that checkout.

```sh
export NAOS_BUILD_ROOT=/absolute/path/to/naos-at-1596ab0
npm ci
npx playwright install chromium-headless-shell webkit
npm test
```

The default suite runs 30 behavioral checks per engine. Six per engine are marked TODO and still execute, so the known capability gaps appear in the output. Run `npm run test:capabilities` to require every capability and reproduce the failures as failing assertions. Use `LAB_BROWSERS=firefox npm test` to run Firefox on a machine where Playwright can launch it. From the repository root, run `pnpm exec tsc -p experiments/ui-sdk/tsconfig.json` for strict authoring type checks.

`npm run build` writes the HTML demos, scripts and exact sizes to `dist/`. The baseline and hybrid stage the pinned checkout’s sources under `build/`. The checked-in patch applies only to the staged hybrid, and the pointer probe applies only while bundling its diagnostic entry. An already-built checkout of the same Naos revision can supply compiler and dependency artifacts via `NAOS_BUILD_ROOT`.
