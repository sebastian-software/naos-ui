import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import {
  createNaosManifest,
  formatNaosCodeFrame,
  isNaosCompilerError,
  renderDeclarativeShadowDom,
  serializeNaosManifest,
  transformComponent,
  type NaosDiagnostic,
  type NaosManifest,
  type NaosManifestComponent,
  type NaosManifestComponentInput,
  type NativeStyleImport,
  type RenderDeclarativeShadowDomRequest,
  type RenderDeclarativeShadowDomResult,
} from "@naos-ui/compiler"
import { createFilter, type FilterPattern, type Plugin } from "vite"

export type NaosVitePluginOptions = {
  include?: FilterPattern
  exclude?: FilterPattern
  prerender?: boolean | NaosDeclarativeShadowDomPrerenderOptions
  manifestFile?: string | false
}

export type NaosDeclarativeShadowDomPrerenderOptions = {
  include?: FilterPattern
  exclude?: FilterPattern
}

export type NaosDeclarativeShadowDomManifestEntry = NaosManifestComponent
export type NaosDeclarativeShadowDomManifest = NaosManifest

export function naos(options: NaosVitePluginOptions = {}): Plugin {
  const filter = createFilter(options.include ?? /\.wc\.tsx$/, options.exclude ?? /node_modules/)
  const prerenderOptions = normalizePrerenderOptions(options.prerender)
  const manifestFile =
    options.manifestFile === undefined ? "naos-manifest.json" : options.manifestFile
  const prerenderFilter = prerenderOptions
    ? createFilter(
        prerenderOptions.include ?? options.include ?? /\.wc\.tsx$/,
        prerenderOptions.exclude ?? options.exclude ?? /node_modules/,
      )
    : null
  const manifest = new Map<string, NaosManifestComponentInput>()

  return {
    name: "naos:transform",
    enforce: "pre",
    async transform(code, id) {
      const filename = stripQuery(id)
      if (!filter(filename)) {
        return null
      }

      try {
        const result = transformComponent({
          filename,
          source: code,
        })

        if (!result.hasChanged) {
          return null
        }

        manifest.set(filename, {
          className: result.className,
          exportName: result.exportName,
          filename,
          package: result.package,
          shadow: result.shadow,
          tagName: result.tagName,
          usesDeclarativeShadowDom: false,
        })

        if (prerenderFilter?.(filename)) {
          const inlineStyles = await resolveInlineStyles(result.styleImports, filename, (cssPath) =>
            this.addWatchFile(cssPath),
          )
          const prerendered = renderNaosDeclarativeShadowDom({
            filename,
            inlineStyles,
            source: code,
          })
          manifest.set(filename, {
            className: prerendered.className,
            exportName: prerendered.exportName,
            filename,
            package: prerendered.package,
            shadow: prerendered.shadow,
            tagName: prerendered.tagName,
            usesDeclarativeShadowDom: prerendered.usesDeclarativeShadowDom,
          })
        }

        return {
          code: result.code,
          map: result.map ?? null,
        }
      } catch (error) {
        if (isNaosCompilerError(error)) {
          const loc = error.diagnostics[0]?.loc
          this.error({
            id: filename,
            message: formatNaosDiagnostics(error.diagnostics, filename),
            ...(loc
              ? {
                  frame: formatNaosCodeFrame(code, loc),
                  loc: {
                    column: loc.startColumn - 1,
                    file: filename,
                    line: loc.startLine,
                  },
                }
              : {}),
          })
        }
        const message = error instanceof Error ? error.message : String(error)
        this.error(`Naos transform failed in ${filename}: ${message}`)
      }
    },
    handleHotUpdate(context) {
      if (!filter(stripQuery(context.file))) {
        return
      }

      // Custom element tags cannot be re-registered, so an edited component
      // module can only take effect through a full page reload.
      context.server.hot.send({ type: "full-reload" })
      return []
    },
    generateBundle() {
      if (!manifestFile || manifest.size === 0) {
        return
      }

      const manifestJson = createNaosManifest([...manifest.values()])

      this.emitFile({
        fileName: manifestFile,
        source: serializeNaosManifest(manifestJson),
        type: "asset",
      })
    },
  }
}

export function formatNaosDiagnostics(
  diagnostics: readonly NaosDiagnostic[],
  fallbackFilename: string,
): string {
  return diagnostics
    .map((diagnostic) => {
      const filename = diagnostic.filename || fallbackFilename
      const location = diagnostic.loc
        ? `:${diagnostic.loc.startLine}:${diagnostic.loc.startColumn}`
        : diagnostic.span
          ? `:${diagnostic.span.start}-${diagnostic.span.end}`
          : ""
      const hint = diagnostic.hint ? `\nhint: ${diagnostic.hint}` : ""
      return `${filename}${location} ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}${hint}`
    })
    .join("\n")
}

export function renderNaosDeclarativeShadowDom(
  request: RenderDeclarativeShadowDomRequest,
): RenderDeclarativeShadowDomResult {
  return renderDeclarativeShadowDom(request)
}

async function resolveInlineStyles(
  styleImports: readonly NativeStyleImport[],
  filename: string,
  addWatchFile: (cssPath: string) => void,
): Promise<Record<string, string> | undefined> {
  if (styleImports.length === 0) {
    return undefined
  }

  const inlineStyles: Record<string, string> = {}
  for (const styleImport of styleImports) {
    const cssPath = resolve(dirname(filename), stripQuery(styleImport.source))
    addWatchFile(cssPath)
    inlineStyles[styleImport.localName] = await readFile(cssPath, "utf8")
  }
  return inlineStyles
}

function stripQuery(id: string): string {
  return id.split("?")[0] ?? id
}

function normalizePrerenderOptions(
  options: NaosVitePluginOptions["prerender"],
): NaosDeclarativeShadowDomPrerenderOptions | null {
  if (options === false) {
    return null
  }
  if (options === undefined || options === true) {
    return {}
  }
  return options
}
