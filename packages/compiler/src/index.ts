import type {
  NativeBindings,
  NativeDeclarativeShadowDomRequest,
  NativeDeclarativeShadowDomResult,
  NativeInfo as GeneratedNativeInfo,
  NativeSourceMap,
  NativeTransformRequest,
  NativeTransformResult,
} from "./generated/naos-node-types.js"
import {
  loadNativeBindings,
  setNativeBindingsForTesting,
} from "./native-loader.js"
import {
  resolveNaosPackageContext,
  type NaosPackageContext,
} from "./package-context.js"

export {
  createNaosManifest,
  serializeNaosManifest,
  type NaosManifest,
  type NaosManifestComponent,
  type NaosManifestComponentInput,
  type NaosManifestPackage,
} from "./manifest.js"
export {
  normalizePackageName,
  resolveNaosPackageContext,
} from "./package-context.js"
export type { NaosPackageContext }

export type NativeInfo = GeneratedNativeInfo
export type SourceMap = NativeSourceMap

export type NaosDiagnosticSeverity = "info" | "warning" | "error"

export type NaosDiagnosticSpan = {
  start: number
  end: number
}

export type NaosDiagnostic = {
  code: string
  severity: NaosDiagnosticSeverity
  message: string
  filename: string
  span?: NaosDiagnosticSpan | null
  hint?: string | null
}

export class NaosCompilerError extends Error {
  readonly diagnostics: NaosDiagnostic[]

  constructor(
    message: string,
    diagnostics: NaosDiagnostic[],
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = "NaosCompilerError"
    this.diagnostics = diagnostics
  }
}

export type TransformComponentRequest = {
  source: string
  filename: string
  packageJsonPath?: string
}

export type ComponentMetadata = {
  tagName: string
  className: string
  exportName?: string | null
  shadow: boolean
  package: NaosPackageContext
}

export type TransformComponentResult = Omit<
  NativeTransformResult,
  "packageName" | "packageVersion" | "tagPrefix"
> & ComponentMetadata

export type DeclarativeShadowDomProps = Record<string, unknown>

export type RenderDeclarativeShadowDomRequest = {
  source: string
  filename: string
  props?: DeclarativeShadowDomProps
  inlineStyles?: Record<string, string>
  packageJsonPath?: string
}

export type RenderDeclarativeShadowDomResult = Omit<
  NativeDeclarativeShadowDomResult,
  "packageName" | "packageVersion" | "tagPrefix"
> & ComponentMetadata
export type { NativeBindings, NativeDeclarativeShadowDomRequest, NativeTransformRequest }

export function getNativeInfo(): NativeInfo {
  return loadNativeBindings().getNativeInfo()
}

export function transformComponent(
  request: TransformComponentRequest
): TransformComponentResult {
  const packageContext = resolveNaosPackageContext(
    request.filename,
    request.packageJsonPath
  )
  const result = withNativeDiagnostics(() =>
    loadNativeBindings().transformComponent({
      filename: request.filename,
      packageName: packageContext.name,
      packageVersion: packageContext.version ?? undefined,
      source: request.source,
      tagPrefix: packageContext.tagPrefix,
    })
  )
  const {
    packageName: _packageName,
    packageVersion: _packageVersion,
    tagPrefix: _tagPrefix,
    ...metadata
  } = result
  return { ...metadata, package: packageContext }
}

export function renderDeclarativeShadowDom(
  request: RenderDeclarativeShadowDomRequest
): RenderDeclarativeShadowDomResult {
  const packageContext = resolveNaosPackageContext(
    request.filename,
    request.packageJsonPath
  )
  const result = withNativeDiagnostics(() =>
    loadNativeBindings().renderDeclarativeShadowDom({
      filename: request.filename,
      inlineStylesJson: request.inlineStyles
        ? JSON.stringify(request.inlineStyles)
        : undefined,
      propsJson: request.props ? JSON.stringify(request.props) : undefined,
      packageName: packageContext.name,
      packageVersion: packageContext.version ?? undefined,
      source: request.source,
      tagPrefix: packageContext.tagPrefix,
    })
  )
  const {
    packageName: _packageName,
    packageVersion: _packageVersion,
    tagPrefix: _tagPrefix,
    ...metadata
  } = result
  return { ...metadata, package: packageContext }
}
export { setNativeBindingsForTesting }

export function isNaosCompilerError(error: unknown): error is NaosCompilerError {
  return error instanceof NaosCompilerError
}

const DIAGNOSTIC_REASON_PREFIX = "NAOS_COMPILER_DIAGNOSTICS:"

function withNativeDiagnostics<T>(operation: () => T): T {
  try {
    return operation()
  } catch (error) {
    throw normalizeNativeError(error)
  }
}

function normalizeNativeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  const markerIndex = message.indexOf(DIAGNOSTIC_REASON_PREFIX)
  if (markerIndex < 0) {
    return error instanceof Error ? error : new Error(message)
  }

  const payloadSource = message.slice(markerIndex + DIAGNOSTIC_REASON_PREFIX.length)
  const payload = parseDiagnosticPayload(payloadSource)
  if (!payload) {
    return error instanceof Error ? error : new Error(message)
  }

  return new NaosCompilerError(payload.message, payload.diagnostics, {
    cause: error,
  })
}

function parseDiagnosticPayload(
  source: string
): { message: string; diagnostics: NaosDiagnostic[] } | null {
  let payload: unknown
  try {
    payload = JSON.parse(source)
  } catch {
    return null
  }

  if (!isRecord(payload) || !Array.isArray(payload.diagnostics)) {
    return null
  }

  const diagnostics = payload.diagnostics.filter(isNaosDiagnostic)
  if (diagnostics.length === 0) {
    return null
  }

  return {
    diagnostics,
    message:
      typeof payload.message === "string"
        ? payload.message
        : diagnostics[0]?.message ?? "Naos compiler failed",
  }
}

function isNaosDiagnostic(value: unknown): value is NaosDiagnostic {
  if (!isRecord(value)) {
    return false
  }

  const severity = value.severity
  return (
    typeof value.code === "string" &&
    typeof value.filename === "string" &&
    typeof value.message === "string" &&
    (severity === "error" || severity === "warning" || severity === "info") &&
    (value.hint === undefined || value.hint === null || typeof value.hint === "string") &&
    (value.span === undefined || value.span === null || isNaosDiagnosticSpan(value.span))
  )
}

function isNaosDiagnosticSpan(value: unknown): value is NaosDiagnosticSpan {
  return (
    isRecord(value) &&
    typeof value.start === "number" &&
    Number.isInteger(value.start) &&
    typeof value.end === "number" &&
    Number.isInteger(value.end)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
