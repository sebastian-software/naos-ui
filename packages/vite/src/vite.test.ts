import { NaosCompilerError, setNativeBindingsForTesting } from "@naos-ui/compiler"
import { readFileSync } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { naos } from "./vite.js"

const { version: packageVersion } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version: string }
const nativeMetadata = {
  className: "CounterElement",
  exportName: "Counter",
  packageName: "@naos-ui/vite",
  packageVersion,
  shadow: true,
  tagName: "naos-ui-vite-counter",
  tagPrefix: "naos-ui-vite",
}
const fixtureFilename = join(process.cwd(), "src/counter.wc.tsx")

describe("naos", () => {
  afterEach(() => {
    setNativeBindingsForTesting(null)
  })

  it("triggers a full reload when a component module changes in dev", () => {
    const plugin = naos()
    const handleHotUpdate = plugin.handleHotUpdate
    if (typeof handleHotUpdate !== "function") {
      throw new Error("Expected handleHotUpdate hook")
    }

    const send = vi.fn()
    const result = handleHotUpdate.call(
      mockPluginContext(),
      mockHotContext(`${fixtureFilename}?raw`, send)
    )

    expect(send).toHaveBeenCalledWith({ type: "full-reload" })
    expect(result).toEqual([])
  })

  it("keeps default hot update handling for other modules", () => {
    const plugin = naos()
    const handleHotUpdate = plugin.handleHotUpdate
    if (typeof handleHotUpdate !== "function") {
      throw new Error("Expected handleHotUpdate hook")
    }

    const send = vi.fn()
    const result = handleHotUpdate.call(
      mockPluginContext(),
      mockHotContext("/src/plain.ts", send)
    )

    expect(send).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it("passes through files outside the include filter", async () => {
    const plugin = naos()
    const transform = plugin.transform
    if (typeof transform !== "function") {
      throw new Error("Expected transform hook")
    }

    const result = await transform.call(mockPluginContext(), "source", "/src/plain.ts")

    expect(result).toBeNull()
  })

  it("transforms wc tsx modules through the native wrapper", async () => {
    setNativeBindingsForTesting({
      getNativeInfo: () => ({ coreVersion: "test" }),
      renderDeclarativeShadowDom: () => ({
        ...nativeMetadata,
        className: "CounterElement",
        exportName: "Counter",
        html: "",
        shadow: true,
        tagName: "naos-ui-vite-counter",
        templateHtml: "",
        usesDeclarativeShadowDom: true,
      }),
      transformComponent: (request) => ({
        ...nativeMetadata,
        code: `compiled:${request.filename}:${request.source}`,
        hasChanged: true,
        styleImports: [],
        props: [],
        events: [],
      }),
    })

    const plugin = naos()
    const transform = plugin.transform
    if (typeof transform !== "function") {
      throw new Error("Expected transform hook")
    }

    const result = await transform.call(
      mockPluginContext(),
      "source",
      `${fixtureFilename}?raw`
    )

    expect(result).toEqual({
      code: `compiled:${fixtureFilename}:source`,
      map: null,
    })
  })

  it("passes native source maps through to Vite", async () => {
    setNativeBindingsForTesting({
      getNativeInfo: () => ({ coreVersion: "test" }),
      renderDeclarativeShadowDom: () => ({
        ...nativeMetadata,
        className: "CounterElement",
        html: "",
        shadow: true,
        tagName: "naos-ui-vite-counter",
        templateHtml: "",
        usesDeclarativeShadowDom: true,
      }),
      transformComponent: (request) => ({
        ...nativeMetadata,
        code: "compiled",
        hasChanged: true,
        map: {
          file: request.filename,
          mappings: "AAAA",
          names: [],
          sources: [request.filename],
          sourcesContent: [request.source],
          version: 3,
        },
        styleImports: [],
        props: [],
        events: [],
      }),
    })

    const plugin = naos()
    const transform = plugin.transform
    if (typeof transform !== "function") {
      throw new Error("Expected transform hook")
    }

    const result = await transform.call(mockPluginContext(), "source", fixtureFilename)

    expect(result).toEqual({
      code: "compiled",
      map: {
        file: fixtureFilename,
        mappings: "AAAA",
        names: [],
        sources: [fixtureFilename],
        sourcesContent: ["source"],
        version: 3,
      },
    })
  })

  it("renders structured diagnostics through the Vite error channel", async () => {
    setNativeBindingsForTesting({
      getNativeInfo: () => ({ coreVersion: "test" }),
      renderDeclarativeShadowDom: () => ({
        ...nativeMetadata,
        className: "CounterElement",
        html: "",
        shadow: true,
        tagName: "naos-ui-vite-counter",
        templateHtml: "",
        usesDeclarativeShadowDom: true,
      }),
      transformComponent: () => {
        throw new NaosCompilerError("Unsupported JSX", [
          {
            code: "NAOS_UNSUPPORTED_SYNTAX",
            filename: fixtureFilename,
            hint: "Use supported syntax.",
            message: "Unsupported JSX",
            severity: "error",
            span: { end: 12, start: 4 },
          },
        ])
      },
    })

    const plugin = naos()
    const transform = plugin.transform
    if (typeof transform !== "function") {
      throw new Error("Expected transform hook")
    }

    await expect(
      transform.call(mockPluginContext(), "source", fixtureFilename)
    ).rejects.toThrow(
      `${fixtureFilename}:4-12 error NAOS_UNSUPPORTED_SYNTAX: Unsupported JSX\nhint: Use supported syntax.`
    )
  })

  it("passes structured locations and a code frame to the Vite error channel", async () => {
    setNativeBindingsForTesting({
      getNativeInfo: () => ({ coreVersion: "test" }),
      renderDeclarativeShadowDom: () => ({
        ...nativeMetadata,
        html: "",
        templateHtml: "",
        usesDeclarativeShadowDom: true,
      }),
      transformComponent: () => {
        throw new NaosCompilerError("Unsupported JSX", [
          {
            code: "NAOS_UNSUPPORTED_CONDITIONAL_JSX",
            filename: fixtureFilename,
            hint: "Use <Show>.",
            loc: { endColumn: 20, endLine: 2, startColumn: 10, startLine: 2 },
            message: "Conditional JSX expressions are not supported.",
            severity: "error",
            span: { end: 30, start: 20 },
          },
        ])
      },
    })

    const plugin = naos()
    const transform = plugin.transform
    if (typeof transform !== "function") {
      throw new Error("Expected transform hook")
    }

    const errors: unknown[] = []
    const context = {
      addWatchFile() {},
      error(error: unknown): never {
        errors.push(error)
        throw new Error("stop")
      },
    } as never

    const source = "const first = 1\nconst second = {oops() ? 1 : 2}\nconst third = 3"
    await expect(transform.call(context, source, fixtureFilename)).rejects.toThrow("stop")

    expect(errors[0]).toMatchObject({
      loc: { column: 9, file: fixtureFilename, line: 2 },
      message: `${fixtureFilename}:2:10 error NAOS_UNSUPPORTED_CONDITIONAL_JSX: Conditional JSX expressions are not supported.\nhint: Use <Show>.`,
    })
    const frame = (errors[0] as { frame: string }).frame
    expect(frame).toContain("> 2 | const second = {oops() ? 1 : 2}")
    expect(frame).toContain("^^^^^^^^^^")
  })

  it("emits a DSD manifest by default", async () => {
    const emitted: unknown[] = []
    setNativeBindingsForTesting({
      getNativeInfo: () => ({ coreVersion: "test" }),
      renderDeclarativeShadowDom: () => ({
        ...nativeMetadata,
        className: "CounterElement",
        exportName: "Counter",
        html: "<naos-ui-vite-counter></naos-ui-vite-counter>",
        shadow: true,
        tagName: "naos-ui-vite-counter",
        templateHtml: '<template shadowrootmode="open"></template>',
        usesDeclarativeShadowDom: true,
      }),
      transformComponent: () => ({
        ...nativeMetadata,
        code: "compiled",
        hasChanged: true,
        styleImports: [],
        props: [],
        events: [],
      }),
    })

    const plugin = naos()
    const transform = plugin.transform
    const generateBundle = plugin.generateBundle
    if (typeof transform !== "function" || typeof generateBundle !== "function") {
      throw new Error("Expected transform and generateBundle hooks")
    }

    await transform.call(mockPluginContext(), "source", fixtureFilename)
    await generateBundle.call(
      {
        emitFile(file: unknown) {
          emitted.push(file)
          return "asset-id"
        },
      } as never,
      {} as never,
      {} as never,
      false
    )

    expect(emitted).toEqual([
      {
        fileName: "naos-manifest.json",
        source:
          `{\n  "schemaVersion": 1,\n  "package": {\n    "name": "@naos-ui/vite",\n    "version": "${packageVersion}",\n    "tagPrefix": "naos-ui-vite"\n  },\n  "components": [\n    {\n      "className": "CounterElement",\n      "exportName": "Counter",\n      "importPath": "src/counter.wc.tsx",\n      "shadow": true,\n      "tagName": "naos-ui-vite-counter",\n      "usesDeclarativeShadowDom": true\n    }\n  ]\n}\n`,
        type: "asset",
      },
    ])
  })

  it("does not prerender when prerendering is disabled", async () => {
    const emitted: unknown[] = []
    let prerenderCalls = 0
    setNativeBindingsForTesting({
      getNativeInfo: () => ({ coreVersion: "test" }),
      renderDeclarativeShadowDom: () => {
        prerenderCalls += 1
        return {
          ...nativeMetadata,
          className: "CounterElement",
          html: "",
          shadow: true,
          tagName: "naos-ui-vite-counter",
          templateHtml: "",
          usesDeclarativeShadowDom: true,
        }
      },
      transformComponent: () => ({
        ...nativeMetadata,
        code: "compiled",
        hasChanged: true,
        styleImports: [],
        props: [],
        events: [],
      }),
    })

    const plugin = naos({ prerender: false })
    const transform = plugin.transform
    const generateBundle = plugin.generateBundle
    if (typeof transform !== "function" || typeof generateBundle !== "function") {
      throw new Error("Expected transform and generateBundle hooks")
    }

    await transform.call(mockPluginContext(), "source", fixtureFilename)
    await generateBundle.call(
      {
        emitFile(file: unknown) {
          emitted.push(file)
          return "asset-id"
        },
      } as never,
      {} as never,
      {} as never,
      false
    )

    expect(prerenderCalls).toBe(0)
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({ fileName: "naos-manifest.json", type: "asset" })
    expect(String((emitted[0] as { source: string }).source)).toContain(
      '"usesDeclarativeShadowDom": false'
    )
  })

  it("passes resolved inline CSS imports to DSD prerendering", async () => {
    const root = await mkdtemp(join(tmpdir(), "naos-vite-"))
    try {
      const filename = join(root, "counter.wc.tsx")
      await writeFile(
        join(root, "package.json"),
        '{"name":"@example/counter","version":"1.0.0"}\n'
      )
      await writeFile(join(root, "counter.css"), ":host { display: block; }\n")
      let inlineStylesJson: string | undefined

      setNativeBindingsForTesting({
        getNativeInfo: () => ({ coreVersion: "test" }),
        renderDeclarativeShadowDom: (request) => {
          inlineStylesJson = request.inlineStylesJson
          return {
            ...nativeMetadata,
            className: "CounterElement",
            exportName: "Counter",
            html: "<naos-ui-vite-counter></naos-ui-vite-counter>",
            shadow: true,
            tagName: "naos-ui-vite-counter",
            templateHtml: '<template shadowrootmode="open"></template>',
            usesDeclarativeShadowDom: true,
          }
        },
        transformComponent: () => ({
          ...nativeMetadata,
          code: "compiled",
          hasChanged: true,
          styleImports: [{ localName: "css", source: "./counter.css?inline" }],
          props: [],
          events: [],
        }),
      })

      const plugin = naos()
      const transform = plugin.transform
      if (typeof transform !== "function") {
        throw new Error("Expected transform hook")
      }

      await transform.call(
        mockPluginContext(),
        'import css from "./counter.css?inline";\nexport const options = { styles: [css] }',
        filename
      )

      expect(inlineStylesJson).toBe('{"css":":host { display: block; }\\n"}')
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it("registers resolved inline CSS files as watch dependencies", async () => {
    const root = await mkdtemp(join(tmpdir(), "naos-vite-"))
    try {
      const filename = join(root, "counter.wc.tsx")
      await writeFile(
        join(root, "package.json"),
        '{"name":"@example/counter","version":"1.0.0"}\n'
      )
      await writeFile(join(root, "counter.css"), ":host { display: block; }\n")

      setNativeBindingsForTesting({
        getNativeInfo: () => ({ coreVersion: "test" }),
        renderDeclarativeShadowDom: () => ({
          ...nativeMetadata,
          html: "<naos-ui-vite-counter></naos-ui-vite-counter>",
          templateHtml: '<template shadowrootmode="open"></template>',
          usesDeclarativeShadowDom: true,
        }),
        transformComponent: () => ({
          ...nativeMetadata,
          code: "compiled",
          hasChanged: true,
          styleImports: [{ localName: "css", source: "./counter.css?inline" }],
          props: [],
          events: [],
        }),
      })

      const plugin = naos()
      const transform = plugin.transform
      if (typeof transform !== "function") {
        throw new Error("Expected transform hook")
      }

      const addWatchFile = vi.fn()
      await transform.call(
        {
          addWatchFile,
          error(error: string): never {
            throw new Error(error)
          },
        } as never,
        'import css from "./counter.css?inline";\nexport const options = { styles: [css] }',
        filename
      )

      expect(addWatchFile).toHaveBeenCalledWith(join(root, "counter.css"))
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})

function mockPluginContext() {
  return {
    addWatchFile() {},
    error(error: string | { message: string }): never {
      throw new Error(typeof error === "string" ? error : error.message)
    },
  } as never
}

function mockHotContext(file: string, send: (payload: unknown) => void) {
  return {
    file,
    modules: [],
    server: { hot: { send } },
  } as never
}
