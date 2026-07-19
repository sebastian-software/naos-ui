import { useCallback, useEffect, useRef, useState } from "react"
import type { MetaFunction } from "react-router"
import config from "virtual:ardo/config"

import {
  PlaygroundCompiler,
  type PlaygroundDiagnostic,
  mountPlaygroundModule,
  rewriteRuntimeImports,
} from "../lib/playground-compiler"

export const meta: MetaFunction = () => [
  { title: "Playground - Naos" },
  {
    name: "description",
    content: "Compile Naos TSX components to native Custom Elements directly in the browser.",
  },
]

const SAMPLE_SOURCE = `import { clx, computed, state } from "@naos-ui/core"

export function Counter({ label = "Count" }) {
  const count = state(0)
  const text = computed(() => \`\${label}: \${count()}\`)

  return (
    <button
      class={clx("counter", { active: count() > 0 })}
      style={{ "--count": String(count()) }}
      onClick={() => count.update((value) => value + 1)}
    >
      {text()}
    </button>
  )
}
`

function withBase(path: string): string {
  const base = config.base?.replace(/\/?$/, "/") ?? "/"
  return `${base}${path.replace(/^\//, "")}`
}

function assetUrl(path: string): string {
  return new URL(withBase(path), window.location.origin).href
}

type CompilerState =
  | { status: "loading" }
  | { status: "ready"; compiler: PlaygroundCompiler }
  | { status: "unavailable"; reason: string }

type RunState = {
  code: string
  tagName: string
  coreVersion: string
  diagnostics: PlaygroundDiagnostic[]
  message: string | null
  previewError: string | null
}

const INITIAL_RUN: RunState = {
  code: "",
  tagName: "",
  coreVersion: "",
  diagnostics: [],
  message: null,
  previewError: null,
}

let nextInstanceId = 1

export default function PlaygroundPage() {
  const [source, setSource] = useState(SAMPLE_SOURCE)
  const [compilerState, setCompilerState] = useState<CompilerState>({ status: "loading" })
  const [run, setRun] = useState<RunState>(INITIAL_RUN)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let disposed = false
    PlaygroundCompiler.load(assetUrl("playground/naos-compiler.wasm"))
      .then((compiler) => {
        if (!disposed) setCompilerState({ status: "ready", compiler })
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setCompilerState({
            status: "unavailable",
            reason: error instanceof Error ? error.message : String(error),
          })
        }
      })
    return () => {
      disposed = true
    }
  }, [])

  const runSource = useCallback(async (compiler: PlaygroundCompiler, nextSource: string) => {
    // A fresh tag prefix per run sidesteps the one-shot
    // customElements.define registry when the module is re-imported.
    const result = compiler.transform(nextSource, `play${nextInstanceId}`)
    nextInstanceId += 1
    if (!result.ok) {
      setRun({
        ...INITIAL_RUN,
        diagnostics: result.diagnostics,
        message: result.message,
      })
      return
    }

    const runtimeCode = rewriteRuntimeImports(result.code, {
      runtime: assetUrl("playground/naos-runtime.js"),
      motion: assetUrl("playground/naos-motion.js"),
    })
    let previewError: string | null = null
    if (previewRef.current) {
      try {
        await mountPlaygroundModule(runtimeCode, result.tagName, previewRef.current)
      } catch (error) {
        previewError = error instanceof Error ? error.message : String(error)
      }
    }
    setRun({
      ...INITIAL_RUN,
      code: result.code,
      tagName: result.tagName,
      coreVersion: result.coreVersion,
      previewError,
    })
  }, [])

  useEffect(() => {
    if (compilerState.status === "ready") {
      void runSource(compilerState.compiler, SAMPLE_SOURCE)
    }
  }, [compilerState, runSource])

  const handleRun = () => {
    if (compilerState.status === "ready") {
      void runSource(compilerState.compiler, source)
    }
  }

  return (
    <main className="naos-playground">
      <header className="naos-playground-header">
        <h1>Playground</h1>
        <p>
          The Rust compiler core, compiled to WebAssembly, transforms your TSX component to a native
          Custom Element module right here in the browser. Single module only - relative and CSS
          imports are not resolvable in the playground.
        </p>
      </header>

      {compilerState.status === "unavailable" ? (
        <p className="naos-playground-notice" role="alert">
          The compiler module could not be loaded ({compilerState.reason}). If you are running the
          docs locally, build the playground assets first: <code>pnpm build:playground</code>.
        </p>
      ) : null}

      <div className="naos-playground-columns">
        <section className="naos-playground-pane" aria-label="Component source">
          <div className="naos-playground-pane-header">
            <h2>Source</h2>
            <button
              type="button"
              onClick={handleRun}
              disabled={compilerState.status !== "ready"}
              data-playground-run
            >
              {compilerState.status === "loading" ? "Loading compiler..." : "Compile & run"}
            </button>
          </div>
          <textarea
            aria-label="Component source editor"
            spellCheck={false}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault()
                handleRun()
              }
            }}
          />
        </section>

        <section className="naos-playground-pane" aria-label="Compiler output">
          <div className="naos-playground-pane-header">
            <h2>Preview</h2>
            {run.tagName ? <code data-playground-tag>&lt;{run.tagName}&gt;</code> : null}
          </div>
          <div ref={previewRef} className="naos-playground-preview" data-playground-preview />
          {run.previewError ? (
            <p className="naos-playground-notice" role="alert">
              Preview failed: {run.previewError}
            </p>
          ) : null}

          {run.message ? (
            <div className="naos-playground-diagnostics" role="alert">
              <h3>Diagnostics</h3>
              <ul>
                {run.diagnostics.length === 0 ? <li>{run.message}</li> : null}
                {run.diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.code}-${index}`}>
                    <strong>{diagnostic.code}</strong>
                    {diagnostic.loc
                      ? ` (line ${diagnostic.loc.startLine}, column ${diagnostic.loc.startColumn})`
                      : null}
                    : {diagnostic.message}
                    {diagnostic.hint ? <em> {diagnostic.hint}</em> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {run.code ? (
            <details className="naos-playground-code" open>
              <summary>
                Generated module
                {run.coreVersion ? ` (naos-core ${run.coreVersion})` : null}
              </summary>
              <pre>
                <code data-playground-code>{run.code}</code>
              </pre>
            </details>
          ) : null}
        </section>
      </div>
    </main>
  )
}
