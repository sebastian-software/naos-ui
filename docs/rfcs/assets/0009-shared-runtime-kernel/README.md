# RFC 0009 Measurement Assets

Prototype sources and the benchmark harness behind the numbers in
[RFC 0009](../../0009-shared-runtime-kernel.md). These are analysis artifacts,
not shipped code: the two runtime variants are feature-equivalent to each
other (same logic, different organization) but intentionally omit the
hydration/DSD paths, so absolute sizes are indicative rather than final.

## Files

* `runtime-class.js` — variant A: abstract `NaosElement` base class.
* `runtime-fn.js` — variant B: free functions over a per-instance kernel
  record.
* `gen-toggle-class.js` / `gen-toggle-fn.js` — hand-translated compiler output
  for `examples/counter/src/toggle.wc.tsx` under each variant.
* `gen-board-class.js` / `gen-board-fn.js` — same for the static
  `examples/tasks/src/board.wc.tsx`.
* `bench.mjs` — dispatch/memory micro-benchmark mirroring the flush pipeline
  without DOM.

## Reproducing the size numbers

esbuild 0.24.0; gzip sizes are `gzip -9 | wc -c`.

```sh
# runtime alone / component + runtime bundled
npx esbuild@0.24.0 runtime-fn.js    --bundle --minify --format=esm
npx esbuild@0.24.0 gen-board-fn.js  --bundle --minify --format=esm
npx esbuild@0.24.0 gen-toggle-fn.js --bundle --minify --format=esm

# marginal per-component cost (runtime shared elsewhere)
npx esbuild@0.24.0 gen-toggle-fn.js --bundle --minify --format=esm \
  --external:./runtime-fn.js
```

Swap `-fn` for `-class` for variant A. Current-output sizes in the RFC come
from compiling the example `.wc.tsx` sources with `naos-core` at `e1930db`
(`transform_component_module`) and minifying the result the same way, with
`?inline` CSS imports and cross-module imports stubbed/marked external.

## Reproducing the benchmark

```sh
node --expose-gc bench.mjs
```

Node 22. The harness creates 20 000 instances per variant, runs 200 update
cycles over each (4 M flushes), takes the median of 5 interleaved runs via
`performance.now()`, and estimates heap per instance from the `heapUsed`
delta across 50 000 retained instances after forced GC.
