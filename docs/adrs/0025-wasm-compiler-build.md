# ADR 0025: WASM Compiler Build As Fallback Tier And Playground Engine

Status: Accepted

Weight: P2

## Context

The compiler ships exclusively as N-API binaries for 8 native targets
(ADR 0012). The unsupported-platform error is clear, but there is no
functional fallback, and install-time source builds are ruled out by design.
Users on unlisted targets (FreeBSD, older glibc, future architectures, edge
runtimes) are fully blocked, and a browser playground — the most effective
evaluation tool for a compiler project — is impossible because nothing
compiles in the browser.

Issue #121 asked for a measured go/no-go decision on a WASM build of
`naos-core` before any implementation.

## Measurements

All numbers from a probe build of an unmodified `naos-core` behind a ~40-line
C-ABI wrapper crate (`crate-type = ["cdylib"]`), Rust stable, fat LTO,
`strip = true`, `codegen-units = 1`, measured on x86_64 Linux with Node 22.

Compatibility:

- `naos-core` (including OXC parser, analysis, codegen, DSD rendering paths)
  compiles to `wasm32-unknown-unknown` **without any source change**.
- `wasm32-wasip1` builds as well (1.12 MB), keeping a fallback path open if a
  future dependency needs WASI clocks, randomness, or file APIs.
- The `wasm32-unknown-unknown` module has **zero imports** — it instantiates
  in browsers, Node, and edge runtimes without any shim or glue runtime.
- Transform output is **byte-identical** to the native binding for the
  example components.

Size:

| Artifact | Raw | Gzip |
| --- | --- | --- |
| WASM, `opt-level = 3` | 1.16 MB | 346 KB |
| WASM, `opt-level = "z"` | 691 KB | 255 KB |
| Native `.so`, release, one of 8 targets (x86_64 Linux) | 2.72 MB | — |

Performance (400 iterations after warmup; `us/op`):

| Input | Native release | WASM `opt-level = 3` | Ratio |
| --- | --- | --- | --- |
| `counter.wc.tsx` (778 chars) | 1,327 us | 2,082 us | 1.57x |
| `reactivity-probe.wc.tsx` (4,960 chars) | 14,209 us | 23,217 us | 1.63x |

The `opt-level = "z"` build is only 0–10% slower than `opt-level = 3` at
roughly 60% of the size. Cold start (compile + instantiate in Node) is
3.5–4.4 ms — irrelevant for both use cases.

## Decision

Go. The feared costs did not materialize: no code changes, ~1 MB raw / ~300 KB
compressed, and a ~1.6x single-threaded slowdown that is imperceptible for
per-file transforms in the fallback role and for interactive use in a
playground. We add `wasm32-unknown-unknown` as a supported build target of
`naos-core` with two consumers, in this order:

1. **Docs-site playground** (first, highest value, no loader-contract risk):
   a browser playground that compiles a `.wc.tsx` source and shows the
   generated element module plus a live preview. Uses the `opt-level = 3`
   build for interactive latency.
2. **Last-resort loader tier**: a `@naos-ui/compiler-wasm` package appended
   to `loadNativeBindingsWithContext` after the env override, platform
   package, and workspace binding tiers. It is **not** a default dependency —
   default installs stay lean; the unsupported-platform error instead gains a
   line recommending `npm install @naos-ui/compiler-wasm`. The wasm glue must
   mirror the full N-API surface (`transformComponent`,
   `renderDeclarativeShadowDom`, `getNativeInfo`) so the loader contract
   stays uniform; results cross the boundary as JSON using the serde
   serialization `naos-core` already has.

The wrapper stays a thin, separate crate (`crates/naos-wasm` or equivalent);
`naos-core` itself remains target-agnostic and free of wasm-specific code.
CI gains one `cargo build --target wasm32-unknown-unknown` leg (~1.5 min
cold, mostly cached).

## Alternatives

- **No-go / status quo**: keeps unlisted platforms fully blocked and rules
  out a playground; rejected because the measured costs are small.
- **WASM as the only distribution**: rejected; the native binding is 1.6x
  faster and N-API integration (ADR 0012) works well for the 8 main targets.
- **`wasm32-wasip1` as primary target**: builds and would work behind Node's
  WASI shim, but the extra imports complicate browser embedding for zero
  benefit today; kept as documented fallback if dependencies ever need WASI.
- **`wasm-bindgen` glue**: nicer ergonomics, but adds a toolchain dependency
  and a JS glue layer; the C-ABI + JSON boundary is sufficient for three
  functions and keeps the module import-free.
- **Auto-installed wasm fallback (optionalDependency)**: rejected for now;
  it would add ~350 KB to every install to serve a small minority of
  platforms. The error-message pointer keeps the cost opt-in.

## Consequences

- Unlisted platforms get a functional, documented escape hatch instead of a
  hard stop.
- The docs site can host a real compiler playground, turning evaluation from
  "clone and build" into "type in a browser".
- One more build target to keep green; OXC updates must keep compiling for
  `wasm32-unknown-unknown` (they do today, and the OXC project itself ships
  a WASM playground).
- Performance-sensitive consumers are unaffected: native bindings remain the
  default on all supported platforms.

## Related Milestones

- Follow-up: `@naos-ui/compiler-wasm` package + loader tier (issue to file).
- Follow-up: docs-site playground scope (issue to file).
