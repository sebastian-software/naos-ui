// Browser glue for the naos-wasm compiler module (ADR 0025). The module has
// zero imports and a C-ABI JSON boundary: buffers cross as exact-length
// allocations owned by `naos_alloc`/`naos_free`, and `naos_transform`
// returns a response-JSON buffer pointer plus an out-parameter length.

export type PlaygroundDiagnosticLocation = {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

export type PlaygroundDiagnostic = {
  code: string
  severity: string
  message: string
  hint?: string | null
  loc?: PlaygroundDiagnosticLocation | null
}

export type PlaygroundTransform =
  | { ok: true; coreVersion: string; code: string; tagName: string }
  | { ok: false; message: string; diagnostics: PlaygroundDiagnostic[] }

type WasmExports = {
  memory: WebAssembly.Memory
  naos_alloc: (len: number) => number
  naos_free: (ptr: number, len: number) => void
  naos_transform: (ptr: number, len: number, outLenPtr: number) => number
}

type TransformResponse = {
  ok: boolean
  coreVersion?: string
  message?: string
  diagnostics?: PlaygroundDiagnostic[]
  // Core serde serialization is snake_case.
  result?: { code: string; tag_name: string }
}

export class PlaygroundCompiler {
  readonly #exports: WasmExports

  private constructor(exports: WasmExports) {
    this.#exports = exports
  }

  static async load(wasmUrl: string): Promise<PlaygroundCompiler> {
    const response = await fetch(wasmUrl)
    if (!response.ok) {
      throw new Error(`Compiler module unavailable (HTTP ${response.status}).`)
    }
    const fallback = response.clone()
    let instance: WebAssembly.Instance
    try {
      // Streaming compiles while bytes are still in flight.
      instance = (await WebAssembly.instantiateStreaming(response, {})).instance
    } catch {
      // Some static hosts serve .wasm without the application/wasm MIME type.
      instance = (await WebAssembly.instantiate(await fallback.arrayBuffer(), {})).instance
    }
    return new PlaygroundCompiler(instance.exports as WasmExports)
  }

  transform(source: string, tagPrefix: string): PlaygroundTransform {
    const { memory, naos_alloc, naos_free, naos_transform } = this.#exports
    const request = new TextEncoder().encode(
      JSON.stringify({
        source,
        filename: "playground.wc.tsx",
        packageName: "@naos-ui/playground",
        packageVersion: "0.0.0",
        tagPrefix,
      }),
    )

    const requestPtr = naos_alloc(request.length)
    // 4 bytes: wasm32 usize is 32-bit; matches the getUint32 read below.
    const outLenPtr = naos_alloc(4)
    let responseText: string
    try {
      new Uint8Array(memory.buffer, requestPtr, request.length).set(request)
      const responsePtr = naos_transform(requestPtr, request.length, outLenPtr)
      const responseLen = new DataView(memory.buffer).getUint32(outLenPtr, true)
      try {
        responseText = new TextDecoder().decode(
          new Uint8Array(memory.buffer, responsePtr, responseLen),
        )
      } finally {
        naos_free(responsePtr, responseLen)
      }
    } finally {
      naos_free(requestPtr, request.length)
      naos_free(outLenPtr, 4)
    }

    const response = JSON.parse(responseText) as TransformResponse
    if (response.ok && response.result) {
      return {
        ok: true,
        coreVersion: response.coreVersion ?? "",
        code: response.result.code,
        tagName: response.result.tag_name,
      }
    }
    return {
      ok: false,
      message: response.message ?? "Transform failed.",
      diagnostics: response.diagnostics ?? [],
    }
  }
}

/**
 * Rewrites the bare runtime package imports of a generated module to the
 * bundled playground assets so the module loads from a blob URL without an
 * import map.
 */
export function rewriteRuntimeImports(
  code: string,
  assetUrls: { runtime: string; runtimeInternal: string; motion: string },
): string {
  // Codegen emits double-quoted specifiers today; match both quote styles
  // anyway so a future emitter change fails loudly here instead of at import.
  return code
    .replace(
      /from\s+["']@naos-ui\/runtime\/internal["']/g,
      `from ${JSON.stringify(assetUrls.runtimeInternal)}`,
    )
    .replace(/from\s+["']@naos-ui\/runtime["']/g, `from ${JSON.stringify(assetUrls.runtime)}`)
    .replace(/from\s+["']@naos-ui\/motion["']/g, `from ${JSON.stringify(assetUrls.motion)}`)
}

/**
 * Loads a generated module from a blob URL and mounts its custom element.
 * When `isCurrent` reports false after the module import resolved, the mount
 * is skipped so a superseded run cannot overwrite a newer preview.
 */
export async function mountPlaygroundModule(
  code: string,
  tagName: string,
  container: HTMLElement,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const moduleUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }))
  try {
    await import(/* @vite-ignore */ moduleUrl)
  } finally {
    URL.revokeObjectURL(moduleUrl)
  }
  if (!isCurrent()) return
  container.replaceChildren(document.createElement(tagName))
}
