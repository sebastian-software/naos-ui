import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { IktiaCompilerError, setNativeBindingsForTesting } from "@iktia/compiler"
import { afterEach, describe, expect, it } from "vitest"

import { runCli, type CliIo } from "./cli.js"

function createIo(cwd?: string): CliIo & { stderrText(): string; stdoutText(): string } {
  let stdout = ""
  let stderr = ""
  return {
    cwd,
    stderr: {
      write(chunk: string) {
        stderr += chunk
      },
    },
    stderrText() {
      return stderr
    },
    stdout: {
      write(chunk: string) {
        stdout += chunk
      },
    },
    stdoutText() {
      return stdout
    },
  }
}

describe("@iktia/cli", () => {
  afterEach(() => {
    setNativeBindingsForTesting(null)
  })

  it("prints native info", async () => {
    setNativeBindingsForTesting({
      getNativeInfo: () => ({ coreVersion: "1.2.3" }),
      renderDeclarativeShadowDom: () => ({
        className: "CounterElement",
        html: "",
        shadow: true,
        tagName: "x-counter",
        templateHtml: "",
        usesDeclarativeShadowDom: true,
      }),
      transformComponent: () => ({ code: "", hasChanged: false }),
    })
    const io = createIo()

    await expect(runCli(["info"], io)).resolves.toBe(0)
    expect(JSON.parse(io.stdoutText())).toMatchObject({
      native: { coreVersion: "1.2.3" },
    })
  })

  it("compiles to stdout", async () => {
    const root = await mkdtemp(join(tmpdir(), "iktia-cli-"))
    try {
      await writeFile(join(root, "counter.wc.tsx"), "source")
      setNativeBindingsForTesting({
        getNativeInfo: () => ({ coreVersion: "1.2.3" }),
        renderDeclarativeShadowDom: () => ({
          className: "CounterElement",
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
      const io = createIo(root)

      await expect(runCli(["compile", "counter.wc.tsx"], io)).resolves.toBe(0)
      expect(io.stdoutText()).toBe(`compiled:${join(root, "counter.wc.tsx")}:source\n`)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it("writes compiled code and source maps to files", async () => {
    const root = await mkdtemp(join(tmpdir(), "iktia-cli-"))
    try {
      await writeFile(join(root, "counter.wc.tsx"), "source")
      setNativeBindingsForTesting({
        getNativeInfo: () => ({ coreVersion: "1.2.3" }),
        renderDeclarativeShadowDom: () => ({
          className: "CounterElement",
          html: "",
          shadow: true,
          tagName: "x-counter",
          templateHtml: "",
          usesDeclarativeShadowDom: true,
        }),
        transformComponent: (request) => ({
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
        }),
      })
      const io = createIo(root)

      await expect(
        runCli(["compile", "counter.wc.tsx", "-o", "counter.js"], io)
      ).resolves.toBe(0)
      expect(await readFile(join(root, "counter.js"), "utf8")).toBe(
        "compiled\n//# sourceMappingURL=counter.js.map\n"
      )
      expect(JSON.parse(await readFile(join(root, "counter.js.map"), "utf8"))).toMatchObject({
        mappings: "AAAA",
        sourcesContent: ["source"],
        version: 3,
      })
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it("prerenders with props and resolved inline styles", async () => {
    const root = await mkdtemp(join(tmpdir(), "iktia-cli-"))
    try {
      await writeFile(
        join(root, "counter.wc.tsx"),
        'import css from "./counter.css?inline";\nexport const options = { styles: [css] }'
      )
      await writeFile(join(root, "counter.css"), ":host { display: block; }\n")
      let propsJson: string | undefined
      let inlineStylesJson: string | undefined

      setNativeBindingsForTesting({
        getNativeInfo: () => ({ coreVersion: "1.2.3" }),
        renderDeclarativeShadowDom: (request) => {
          propsJson = request.propsJson
          inlineStylesJson = request.inlineStylesJson
          return {
            className: "CounterElement",
            html: "<x-counter></x-counter>",
            shadow: true,
            tagName: "x-counter",
            templateHtml: '<template shadowrootmode="open"></template>',
            usesDeclarativeShadowDom: true,
          }
        },
        transformComponent: () => ({ code: "", hasChanged: false }),
      })
      const io = createIo(root)

      await expect(
        runCli([
          "prerender",
          "counter.wc.tsx",
          "--props",
          '{"label":"Count"}',
          "-o",
          "counter.html",
        ], io)
      ).resolves.toBe(0)
      expect(await readFile(join(root, "counter.html"), "utf8")).toBe(
        "<x-counter></x-counter>\n"
      )
      expect(propsJson).toBe('{"label":"Count"}')
      expect(inlineStylesJson).toBe('{"css":":host { display: block; }\\n"}')
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it("renders structured compiler diagnostics to stderr", async () => {
    const root = await mkdtemp(join(tmpdir(), "iktia-cli-"))
    try {
      await writeFile(join(root, "counter.wc.tsx"), "source")
      setNativeBindingsForTesting({
        getNativeInfo: () => ({ coreVersion: "1.2.3" }),
        renderDeclarativeShadowDom: () => ({
          className: "CounterElement",
          html: "",
          shadow: true,
          tagName: "x-counter",
          templateHtml: "",
          usesDeclarativeShadowDom: true,
        }),
        transformComponent: () => {
          throw new IktiaCompilerError("Unsupported JSX", [
            {
              code: "IKTIA_UNSUPPORTED_SYNTAX",
              filename: "counter.wc.tsx",
              hint: "Use supported syntax.",
              message: "Unsupported JSX",
              severity: "error",
              span: { end: 12, start: 4 },
            },
          ])
        },
      })
      const io = createIo(root)

      await expect(runCli(["compile", "counter.wc.tsx"], io)).resolves.toBe(1)
      expect(io.stderrText()).toBe(
        "counter.wc.tsx:4-12 error IKTIA_UNSUPPORTED_SYNTAX: Unsupported JSX\nhint: Use supported syntax.\n"
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})
