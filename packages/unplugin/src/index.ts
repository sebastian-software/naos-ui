import { readFile } from "node:fs/promises"
import { dirname, isAbsolute, resolve } from "node:path"

import {
  formatNaosCodeFrame,
  isNaosCompilerError,
  transformComponent,
  type NaosDiagnostic,
} from "@naos-ui/compiler"
import { createUnplugin, type UnpluginFactory, type UnpluginInstance } from "unplugin"

export type NaosUnpluginOptions = {
  /** Files transformed as Naos components. Defaults to `\.wc\.tsx$`. */
  readonly include?: RegExp
  /** Files never transformed. Defaults to `node_modules`. */
  readonly exclude?: RegExp
}

const INLINE_CSS_QUERY = ".css?inline"

export const naosUnpluginFactory: UnpluginFactory<NaosUnpluginOptions | undefined> = (
  options = {},
  meta,
) => {
  const include = options.include ?? /\.wc\.tsx$/
  const exclude = options.exclude ?? /node_modules/
  // Vite understands `?inline` CSS imports natively; every other bundler gets
  // them resolved and loaded by this plugin.
  const handleInlineCss = meta.framework !== "vite"

  return {
    name: "naos:unplugin",
    enforce: "pre",
    resolveId(id, importer) {
      if (!handleInlineCss || !id.endsWith(INLINE_CSS_QUERY)) {
        return null
      }
      if (isAbsolute(id) || !importer) {
        return id
      }
      return resolve(dirname(stripQuery(importer)), id)
    },
    async load(id) {
      if (!handleInlineCss || !id.endsWith(INLINE_CSS_QUERY)) {
        return null
      }
      const css = await readFile(stripQuery(id), "utf8")
      return { code: `export default ${JSON.stringify(css)};\n`, map: null }
    },
    transform(code, id) {
      const filename = stripQuery(id)
      if (!include.test(filename) || exclude.test(filename)) {
        return null
      }

      try {
        const result = transformComponent({ filename, source: code })
        if (!result.hasChanged) {
          return null
        }
        return { code: result.code, map: result.map ?? null }
      } catch (error) {
        if (isNaosCompilerError(error)) {
          const loc = error.diagnostics[0]?.loc
          const frame = loc ? `\n${formatNaosCodeFrame(code, loc)}` : ""
          throw new Error(`${formatDiagnostics(error.diagnostics, filename)}${frame}`, {
            cause: error,
          })
        }
        throw error
      }
    },
  }
}

function stripQuery(id: string): string {
  const queryIndex = id.indexOf("?")
  return queryIndex === -1 ? id : id.slice(0, queryIndex)
}

function formatDiagnostics(diagnostics: readonly NaosDiagnostic[], filename: string): string {
  if (diagnostics.length === 0) {
    return `Naos failed to compile ${filename}.`
  }
  return diagnostics
    .map((diagnostic) => {
      const location = diagnostic.loc
        ? `${filename}:${diagnostic.loc.startLine}:${diagnostic.loc.startColumn}`
        : filename
      const hint = diagnostic.hint ? ` (${diagnostic.hint})` : ""
      return `[${diagnostic.code}] ${location}: ${diagnostic.message}${hint}`
    })
    .join("\n")
}

/**
 * Bundler-agnostic Naos component transform. Use the per-bundler accessors:
 * `naosPlugin.vite()`, `naosPlugin.rollup()`, `naosPlugin.esbuild()`,
 * `naosPlugin.webpack()`, and `naosPlugin.rspack()`.
 *
 * The full-featured Vite integration (Declarative Shadow DOM prerendering,
 * manifest emission, HMR wiring) remains `@naos-ui/vite`; this package covers
 * the compile step plus `?inline` CSS loading for bundlers without native
 * support. For custom toolchains, `transformComponent()` from
 * `@naos-ui/compiler` is the stable escape hatch this plugin itself is built
 * on.
 */
export const naosPlugin: UnpluginInstance<NaosUnpluginOptions | undefined> =
  createUnplugin(naosUnpluginFactory)

export default naosPlugin
