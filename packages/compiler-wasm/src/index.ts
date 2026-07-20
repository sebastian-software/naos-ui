// WebAssembly fallback binding for @naos-ui/compiler (ADR 0025, #164).
//
// This package mirrors the N-API binding surface (`getNativeInfo`,
// `transformComponent`, `renderDeclarativeShadowDom`) on top of the
// naos-wasm C-ABI module, so the native loader can treat it as a last-resort
// tier on platforms without a prebuilt native package. Failures are thrown
// with the same `NAOS_COMPILER_DIAGNOSTICS:` reason payload the N-API
// binding produces, keeping the caller-facing contract identical.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const DIAGNOSTIC_REASON_PREFIX = "NAOS_COMPILER_DIAGNOSTICS:"

// Structural copies of the @naos-ui/compiler native binding types; kept local
// so this fallback package has no dependency on the compiler package.
export type NativeInfo = {
  coreVersion: string
}

export type NativeTransformRequest = {
  source: string
  filename: string
  packageName: string
  packageVersion?: string
  tagPrefix: string
}

export type NativeSourceMap = {
  version: number
  file: string
  sources: string[]
  sourcesContent: string[]
  names: string[]
  mappings: string
}

export type NativeStyleImport = {
  localName: string
  source: string
}

export type NativePropDefinition = {
  propName: string
  attributeName: string
  kind: string
  defaultValue: string
}

export type NativeEventDefinition = {
  eventName: string
  detailType?: string
}

export type NativeTransformResult = {
  code: string
  map?: NativeSourceMap
  hasChanged: boolean
  styleImports: NativeStyleImport[]
  tagName: string
  className: string
  exportName?: string
  shadow: boolean
  props: NativePropDefinition[]
  events: NativeEventDefinition[]
  packageName: string
  packageVersion?: string
  tagPrefix: string
}

export type NativeDeclarativeShadowDomRequest = NativeTransformRequest & {
  propsJson?: string
  inlineStylesJson?: string
}

export type NativeDeclarativeShadowDomResult = {
  tagName: string
  className: string
  exportName?: string
  html: string
  templateHtml: string
  shadow: boolean
  usesDeclarativeShadowDom: boolean
  packageName: string
  packageVersion?: string
  tagPrefix: string
}

// Core serde serialization is snake_case; these shapes model the wire format.
type WireSourceMap = {
  version: number
  file: string
  sources: string[]
  sources_content: string[]
  names: string[]
  mappings: string
}

type WirePackage = {
  name: string
  version: string | null
  tag_prefix: string
}

type WireTransformResult = {
  code: string
  map: WireSourceMap | null
  has_changed: boolean
  style_imports: Array<{ local_name: string; source: string }>
  tag_name: string
  class_name: string
  export_name: string | null
  shadow: boolean
  props: Array<{
    prop_name: string
    attribute_name: string
    kind: string
    default_value: string
  }>
  events: Array<{ event_name: string; detail_type: string | null }>
  package: WirePackage
}

type WireDsdResult = {
  package: WirePackage
  tag_name: string
  class_name: string
  export_name: string | null
  html: string
  template_html: string
  shadow: boolean
  uses_declarative_shadow_dom: boolean
}

type WireResponse<Result> = {
  ok: boolean
  coreVersion?: string
  message?: string
  diagnostics?: unknown[]
  result?: Result
}

type WasmExports = {
  memory: WebAssembly.Memory
  naos_alloc: (len: number) => number
  naos_free: (ptr: number, len: number) => void
  naos_transform: (ptr: number, len: number, outLenPtr: number) => number
  naos_render_dsd: (ptr: number, len: number, outLenPtr: number) => number
  naos_core_version: (outLenPtr: number) => number
}

let cachedExports: WasmExports | null = null

function wasmModulePath(): string {
  return fileURLToPath(new URL("../native/naos-compiler.wasm", import.meta.url))
}

function loadExports(): WasmExports {
  if (cachedExports) {
    return cachedExports
  }
  const modulePath = wasmModulePath()
  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = new Uint8Array(readFileSync(modulePath))
  } catch (error) {
    throw new Error(
      `@naos-ui/compiler-wasm is missing its WebAssembly module at ${modulePath}. ` +
        `Reinstall the package, or in repository development run \`pnpm --filter @naos-ui/compiler-wasm build\`. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const { exports } = new WebAssembly.Instance(new WebAssembly.Module(bytes), {})
  cachedExports = exports as WasmExports
  return cachedExports
}

function readAndFree(exports: WasmExports, ptr: number, len: number): string {
  try {
    return new TextDecoder().decode(new Uint8Array(exports.memory.buffer, ptr, len))
  } finally {
    exports.naos_free(ptr, len)
  }
}

function callJson<Result>(
  entry: "naos_transform" | "naos_render_dsd",
  request: object,
): WireResponse<Result> {
  const exports = loadExports()
  const requestBytes = new TextEncoder().encode(JSON.stringify(request))
  const requestPtr = exports.naos_alloc(requestBytes.length)
  // 4 bytes: wasm32 usize is 32-bit; matches the getUint32 read below.
  const outLenPtr = exports.naos_alloc(4)
  let responseText: string
  try {
    new Uint8Array(exports.memory.buffer, requestPtr, requestBytes.length).set(requestBytes)
    const responsePtr = exports[entry](requestPtr, requestBytes.length, outLenPtr)
    const responseLen = new DataView(exports.memory.buffer).getUint32(outLenPtr, true)
    responseText = readAndFree(exports, responsePtr, responseLen)
  } finally {
    exports.naos_free(requestPtr, requestBytes.length)
    exports.naos_free(outLenPtr, 4)
  }
  return JSON.parse(responseText) as WireResponse<Result>
}

function unwrap<Result>(response: WireResponse<Result>): Result {
  if (response.ok) {
    if (response.result == null) {
      // A missing result on an ok envelope is a wasm-boundary bug, not a
      // compile error - keep it distinguishable from real diagnostics.
      throw new Error(
        "@naos-ui/compiler-wasm received a malformed response envelope: ok without result.",
      )
    }
    return response.result
  }
  const payload = JSON.stringify({
    message: response.message ?? "Transform failed.",
    diagnostics: response.diagnostics ?? [],
  })
  throw new Error(`${DIAGNOSTIC_REASON_PREFIX}${payload}`)
}

function toNativeSourceMap(map: WireSourceMap | null): NativeSourceMap | undefined {
  if (!map) {
    return undefined
  }
  return {
    version: map.version,
    file: map.file,
    sources: map.sources,
    sourcesContent: map.sources_content,
    names: map.names,
    mappings: map.mappings,
  }
}

/** Returns metadata for the loaded WebAssembly compiler. */
export function getNativeInfo(): NativeInfo {
  const exports = loadExports()
  const outLenPtr = exports.naos_alloc(4)
  let coreVersion: string
  try {
    const versionPtr = exports.naos_core_version(outLenPtr)
    const versionLen = new DataView(exports.memory.buffer).getUint32(outLenPtr, true)
    coreVersion = readAndFree(exports, versionPtr, versionLen)
  } finally {
    exports.naos_free(outLenPtr, 4)
  }
  return { coreVersion }
}

/** Transforms a component module, mirroring the N-API binding surface. */
export function transformComponent(request: NativeTransformRequest): NativeTransformResult {
  const result = unwrap(callJson<WireTransformResult>("naos_transform", request))
  return {
    code: result.code,
    map: toNativeSourceMap(result.map),
    hasChanged: result.has_changed,
    styleImports: result.style_imports.map((styleImport) => ({
      localName: styleImport.local_name,
      source: styleImport.source,
    })),
    tagName: result.tag_name,
    className: result.class_name,
    exportName: result.export_name ?? undefined,
    shadow: result.shadow,
    props: result.props.map((prop) => ({
      propName: prop.prop_name,
      attributeName: prop.attribute_name,
      // Core serializes PropKind variant names; N-API uses lowercase.
      kind: prop.kind.toLowerCase(),
      defaultValue: prop.default_value,
    })),
    events: result.events.map((event) => ({
      eventName: event.event_name,
      detailType: event.detail_type ?? undefined,
    })),
    packageName: result.package.name,
    packageVersion: result.package.version ?? undefined,
    tagPrefix: result.package.tag_prefix,
  }
}

/** Prerenders a component as Declarative Shadow DOM host HTML. */
export function renderDeclarativeShadowDom(
  request: NativeDeclarativeShadowDomRequest,
): NativeDeclarativeShadowDomResult {
  const result = unwrap(callJson<WireDsdResult>("naos_render_dsd", request))
  return {
    tagName: result.tag_name,
    className: result.class_name,
    exportName: result.export_name ?? undefined,
    html: result.html,
    templateHtml: result.template_html,
    shadow: result.shadow,
    usesDeclarativeShadowDom: result.uses_declarative_shadow_dom,
    packageName: result.package.name,
    packageVersion: result.package.version ?? undefined,
    tagPrefix: result.package.tag_prefix,
  }
}
