# CLI

`@iktia/cli` publishes the `iktia` binary. It is a thin command-line surface
over the same native compiler API used by `@iktia/vite`.

## Commands

```sh
iktia compile <input> [-o output] [--stdout] [--json] [--pretty]
iktia prerender <input> [-o output] [--props json] [--stdout] [--json] [--pretty]
iktia info [--json] [--pretty]
```

`compile` transforms one `.wc.tsx` module and writes JavaScript. With `-o`, the
CLI also writes a sibling `.map` file when the compiler returns a source map.
Without `-o`, compiled JavaScript is printed to stdout.
Use `--json` with `-o` to print a deterministic operation summary to stdout
while keeping generated JavaScript in files. `--pretty` pretty-prints that JSON
summary.

`prerender` emits static host HTML with Declarative Shadow DOM by default.
`--props` must be a JSON object. CSS uses the same flat `?inline` import
convention as Vite, and the CLI resolves those CSS files before calling the
native prerender workflow.
Use `--json` with `-o` to print a deterministic prerender summary while writing
HTML to a file.

`info` prints Node platform metadata and native compiler version metadata as
JSON. It defaults to pretty-printed JSON; pass `--json` without `--pretty` for
compact JSON.

## Examples

```sh
iktia compile src/counter.wc.tsx -o dist/counter.js
iktia compile src/counter.wc.tsx -o dist/counter.js --json
iktia prerender src/counter.wc.tsx --props '{"label":"Count"}' --stdout
iktia info --pretty
```

## Diagnostics

Compiler failures are rendered from structured `diagnostics[]` entries:

```txt
counter.wc.tsx:4-12 error IKTIA_UNSUPPORTED_SYNTAX: Unsupported JSX
hint: Use supported syntax.
```

The CLI exits with status `1` when compilation or prerendering fails.
