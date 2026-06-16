import type {
  NativeBindings,
  NativeDeclarativeShadowDomRequest,
  NativeDeclarativeShadowDomResult,
  NativeInfo as GeneratedNativeInfo,
  NativeTransformRequest,
  NativeTransformResult,
} from "./generated/iktia-node-types.js"
import {
  loadNativeBindings,
  setNativeBindingsForTesting,
} from "./native-loader.js"

export type NativeInfo = GeneratedNativeInfo

export type TransformComponentRequest = {
  source: string
  filename: string
}

export type TransformComponentResult = NativeTransformResult

export type DeclarativeShadowDomProps = Record<string, unknown>

export type RenderDeclarativeShadowDomRequest = {
  source: string
  filename: string
  props?: DeclarativeShadowDomProps
  inlineStyles?: Record<string, string>
}

export type RenderDeclarativeShadowDomResult = NativeDeclarativeShadowDomResult
export type { NativeBindings, NativeDeclarativeShadowDomRequest, NativeTransformRequest }

export function getNativeInfo(): NativeInfo {
  return loadNativeBindings().getNativeInfo()
}

export function transformComponent(
  request: TransformComponentRequest
): TransformComponentResult {
  return loadNativeBindings().transformComponent(request)
}

export function renderDeclarativeShadowDom(
  request: RenderDeclarativeShadowDomRequest
): RenderDeclarativeShadowDomResult {
  return loadNativeBindings().renderDeclarativeShadowDom({
    filename: request.filename,
    inlineStylesJson: request.inlineStyles
      ? JSON.stringify(request.inlineStyles)
      : undefined,
    propsJson: request.props ? JSON.stringify(request.props) : undefined,
    source: request.source,
  })
}
export { setNativeBindingsForTesting }
