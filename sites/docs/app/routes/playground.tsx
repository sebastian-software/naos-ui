import { useCallback, useEffect, useRef, useState } from "react"
import type { MetaFunction } from "react-router"
import config from "virtual:ardo/config"

import { CodeEditor } from "../components/code-editor"
import { highlightGeneratedModule } from "../lib/highlight"
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

const SAMPLE_SOURCE = `import { clx, state } from "@naos-ui/core"

export const options = {
  styles: [
    \`
    button {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      border: 0;
      border-radius: 999px;
      padding: 0.7rem 1.5rem;
      background: #0f766e;
      color: #ffffff;
      font: 600 1rem/1 system-ui, sans-serif;
      cursor: pointer;
      transition: background 150ms ease, transform 150ms ease;
    }
    button:hover { background: #115e59; }
    button:active { transform: scale(0.96); }
    .badge {
      display: inline-grid;
      place-items: center;
      min-width: 1.7rem;
      height: 1.7rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.25);
      font-size: 0.85rem;
      transition: background 150ms ease;
    }
    button.active .badge { background: #f59e0b; color: #451a03; }
    \`,
  ],
}

export function Counter({ label = "Count" }) {
  const count = state(0)

  return (
    <button
      class={clx({ active: count() > 0 })}
      onClick={() => count.update((value) => value + 1)}
    >
      {label}
      <span class="badge">{count()}</span>
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
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef(source)
  sourceRef.current = source

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
      setRun((previous) => ({
        ...previous,
        diagnostics: result.diagnostics,
        message: result.message,
        previewError: null,
      }))
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

  // Compile on load and auto-recompile shortly after edits settle.
  useEffect(() => {
    if (compilerState.status !== "ready") return
    const timeout = window.setTimeout(() => {
      void runSource(compilerState.compiler, source)
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [compilerState, source, runSource])

  useEffect(() => {
    if (!run.code) {
      setHighlightedCode(null)
      return
    }
    let disposed = false
    highlightGeneratedModule(run.code)
      .then((html) => {
        if (!disposed) setHighlightedCode(html)
      })
      .catch(() => {
        if (!disposed) setHighlightedCode(null)
      })
    return () => {
      disposed = true
    }
  }, [run.code])

  const handleRun = () => {
    if (compilerState.status === "ready") {
      void runSource(compilerState.compiler, sourceRef.current)
    }
  }

  const statusChip =
    compilerState.status === "loading" ? (
      <span className="naos-playground-chip" data-state="loading">
        Loading compiler...
      </span>
    ) : compilerState.status === "ready" ? (
      <span className="naos-playground-chip" data-state="ready">
        naos-core {run.coreVersion || "ready"} - WebAssembly
      </span>
    ) : (
      <span className="naos-playground-chip" data-state="unavailable">
        Compiler unavailable
      </span>
    )

  return (
    <main className="naos-playground">
      <header className="naos-playground-header">
        <div>
          <h1>Playground</h1>
          <p>
            The Rust compiler core, compiled to WebAssembly, transforms your TSX component into a
            native Custom Element module right here in the browser - no server involved.
          </p>
        </div>
        {statusChip}
      </header>

      {compilerState.status === "unavailable" ? (
        <p className="naos-playground-notice" role="alert">
          The compiler module could not be loaded ({compilerState.reason}). If you are running the
          docs locally, build the playground assets first: <code>pnpm build:playground</code>.
        </p>
      ) : null}

      <div className="naos-playground-columns">
        <section className="naos-playground-pane" data-pane="editor" aria-label="Component source">
          <div className="naos-playground-pane-header">
            <h2>Source</h2>
            <div className="naos-playground-pane-tools">
              <kbd>Cmd/Ctrl + Enter</kbd>
              <button
                type="button"
                onClick={handleRun}
                disabled={compilerState.status !== "ready"}
                data-playground-run
              >
                Run
              </button>
            </div>
          </div>
          <CodeEditor
            value={source}
            onChange={setSource}
            onSubmit={handleRun}
            ariaLabel="Component source editor"
          />
        </section>

        <section className="naos-playground-pane" data-pane="preview" aria-label="Live preview">
          <div className="naos-playground-pane-header">
            <h2>Preview</h2>
            {run.tagName ? <code data-playground-tag>&lt;{run.tagName}&gt;</code> : null}
          </div>
          <div className="naos-playground-stage">
            <div ref={previewRef} data-playground-preview />
          </div>
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
          ) : (
            <p className="naos-playground-hint">
              Single module only - relative and CSS imports are not resolvable in the playground.
            </p>
          )}
        </section>
      </div>

      {run.code ? (
        <details className="naos-playground-code" open>
          <summary>Generated module</summary>
          {highlightedCode ? (
            <div
              data-playground-code
              // Shiki output is generated locally from the compiled module.
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          ) : (
            <pre data-playground-code>
              <code>{run.code}</code>
            </pre>
          )}
        </details>
      ) : null}
    </main>
  )
}
