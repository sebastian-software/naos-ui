import { setNativeBindingsForTesting } from "@iktia/compiler"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { iktia } from "./vite.js"

describe("iktia", () => {
  afterEach(() => {
    setNativeBindingsForTesting(null)
  })

  it("passes through files outside the include filter", async () => {
    const plugin = iktia()
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
        className: "CounterElement",
        exportName: "Counter",
        html: "",
        shadow: true,
        tagName: "x-counter",
        templateHtml: "",
        usesDeclarativeShadowDom: true,
      }),
      transformComponent: (request) => ({
        code: `compiled:${request.filename}:${request.source}`,
        hasChanged: true,
      }),
    })

    const plugin = iktia()
    const transform = plugin.transform
    if (typeof transform !== "function") {
      throw new Error("Expected transform hook")
    }

    const result = await transform.call(mockPluginContext(), "source", "/src/counter.wc.tsx?raw")

    expect(result).toEqual({
      code: "compiled:/src/counter.wc.tsx:source",
      map: null,
    })
  })

  it("emits a DSD manifest only when prerendering is enabled", async () => {
    const emitted: unknown[] = []
    setNativeBindingsForTesting({
      getNativeInfo: () => ({ coreVersion: "test" }),
      renderDeclarativeShadowDom: () => ({
        className: "CounterElement",
        exportName: "Counter",
        html: "<x-counter></x-counter>",
        shadow: true,
        tagName: "x-counter",
        templateHtml: '<template shadowrootmode="open"></template>',
        usesDeclarativeShadowDom: true,
      }),
      transformComponent: () => ({
        code: "compiled",
        hasChanged: true,
      }),
    })

    const plugin = iktia({
      prerender: {
        manifestFile: "components.json",
      },
    })
    const transform = plugin.transform
    const generateBundle = plugin.generateBundle
    if (typeof transform !== "function" || typeof generateBundle !== "function") {
      throw new Error("Expected transform and generateBundle hooks")
    }

    await transform.call(mockPluginContext(), "source", "/src/counter.wc.tsx")
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
        fileName: "components.json",
        source:
          '{\n  "components": [\n    {\n      "className": "CounterElement",\n      "clientModule": "/src/counter.wc.tsx",\n      "exportName": "Counter",\n      "importPath": "/src/counter.wc.tsx",\n      "shadow": true,\n      "tagName": "x-counter",\n      "usesDeclarativeShadowDom": true\n    }\n  ]\n}\n',
        type: "asset",
      },
    ])
  })

  it("passes resolved inline CSS imports to DSD prerendering", async () => {
    const root = await mkdtemp(join(tmpdir(), "iktia-vite-"))
    try {
      const filename = join(root, "counter.wc.tsx")
      await writeFile(join(root, "counter.css"), ":host { display: block; }\n")
      let inlineStylesJson: string | undefined

      setNativeBindingsForTesting({
        getNativeInfo: () => ({ coreVersion: "test" }),
        renderDeclarativeShadowDom: (request) => {
          inlineStylesJson = request.inlineStylesJson
          return {
            className: "CounterElement",
            exportName: "Counter",
            html: "<x-counter></x-counter>",
            shadow: true,
            tagName: "x-counter",
            templateHtml: '<template shadowrootmode="open"></template>',
            usesDeclarativeShadowDom: true,
          }
        },
        transformComponent: () => ({
          code: "compiled",
          hasChanged: true,
        }),
      })

      const plugin = iktia({ prerender: true })
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
})

function mockPluginContext() {
  return {
    error(error: string): never {
      throw new Error(error)
    },
  } as never
}
