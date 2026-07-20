import { createEditor } from "./editor"
import { examples } from "./examples"
import { highlightGeneratedModule } from "./highlight"
import {
  PlaygroundCompiler,
  type PlaygroundDiagnostic,
  mountPlaygroundModule,
  rewriteRuntimeImports,
} from "./compiler"

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).href
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing playground element #${id}`)
  return found as T
}

const exampleSelect = element<HTMLSelectElement>("example-select")
const exampleDescription = element<HTMLParagraphElement>("example-description")
const statusChip = element<HTMLSpanElement>("status-chip")
const runButton = element<HTMLButtonElement>("run-button")
const editorHost = element<HTMLDivElement>("editor")
const tagChip = element<HTMLElement>("tag-chip")
const preview = element<HTMLDivElement>("preview")
const previewError = element<HTMLParagraphElement>("preview-error")
const diagnosticsPanel = element<HTMLDivElement>("diagnostics")
const diagnosticsList = element<HTMLUListElement>("diagnostics-list")
const coreChip = element<HTMLSpanElement>("core-chip")
const generated = element<HTMLDivElement>("generated")
const unavailable = element<HTMLParagraphElement>("unavailable")

function renderGeneratedPlain(code: string) {
  const pre = document.createElement("pre")
  const codeElement = document.createElement("code")
  codeElement.textContent = code
  pre.append(codeElement)
  generated.replaceChildren(pre)
}

let compiler: PlaygroundCompiler | null = null
let nextInstanceId = 1
let debounceTimer: number | undefined
let runToken = 0

for (const example of examples) {
  const option = document.createElement("option")
  option.value = example.id
  option.textContent = example.label
  exampleSelect.append(option)
}

const initialExample = examples[0]
if (initialExample) {
  exampleDescription.textContent = initialExample.description
}

const editor = createEditor({
  parent: editorHost,
  doc: initialExample?.source ?? "",
  onChange: scheduleRun,
  onSubmit: run,
})

exampleSelect.addEventListener("change", () => {
  const example = examples.find(({ id }) => id === exampleSelect.value)
  if (!example) return
  exampleDescription.textContent = example.description
  editor.setValue(example.source)
  run()
})

runButton.addEventListener("click", run)

function scheduleRun() {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(run, 350)
}

function renderDiagnostics(message: string, diagnostics: PlaygroundDiagnostic[]) {
  diagnosticsList.replaceChildren()
  const entries = diagnostics.length > 0 ? diagnostics : [null]
  for (const diagnostic of entries) {
    const item = document.createElement("li")
    if (!diagnostic) {
      item.textContent = message
    } else {
      const code = document.createElement("strong")
      code.textContent = diagnostic.code
      const location = diagnostic.loc
        ? ` (line ${diagnostic.loc.startLine}, column ${diagnostic.loc.startColumn})`
        : ""
      item.append(code, `${location}: ${diagnostic.message}`)
      if (diagnostic.hint) {
        const hint = document.createElement("em")
        hint.textContent = ` ${diagnostic.hint}`
        item.append(hint)
      }
    }
    diagnosticsList.append(item)
  }
  diagnosticsPanel.hidden = false
}

async function run() {
  if (!compiler) return
  window.clearTimeout(debounceTimer)
  const token = (runToken += 1)

  // A fresh tag prefix per run sidesteps the one-shot customElements.define
  // registry when the module is re-imported.
  const result = compiler.transform(editor.getValue(), `play${nextInstanceId}`)
  nextInstanceId += 1

  if (!result.ok) {
    renderDiagnostics(result.message, result.diagnostics)
    previewError.hidden = true
    return
  }

  diagnosticsPanel.hidden = true
  tagChip.textContent = `<${result.tagName}>`
  tagChip.hidden = false
  coreChip.textContent = result.coreVersion ? `naos-core ${result.coreVersion}` : ""

  const runtimeCode = rewriteRuntimeImports(result.code, {
    runtime: assetUrl("naos-runtime.js"),
    motion: assetUrl("naos-motion.js"),
  })
  let mountError: unknown = null
  try {
    await mountPlaygroundModule(runtimeCode, result.tagName, preview, () => token === runToken)
  } catch (error) {
    mountError = error
  }
  // A newer run owns the panes from here on.
  if (token !== runToken) return
  if (mountError) {
    previewError.textContent = `Preview failed: ${
      mountError instanceof Error ? mountError.message : String(mountError)
    }`
    previewError.hidden = false
  } else {
    previewError.hidden = true
  }

  renderGeneratedPlain(result.code)
  try {
    const html = await highlightGeneratedModule(result.code)
    if (token === runToken) {
      generated.innerHTML = html
    }
  } catch {
    // Highlighting is best-effort; the plain <pre> stays in place.
  }
}

PlaygroundCompiler.load(assetUrl("naos-compiler.wasm"))
  .then((loaded) => {
    compiler = loaded
    statusChip.dataset.state = "ready"
    statusChip.textContent = "WebAssembly compiler ready"
    runButton.disabled = false
    void run()
  })
  .catch((error: unknown) => {
    statusChip.dataset.state = "unavailable"
    statusChip.textContent = "Compiler unavailable"
    unavailable.textContent =
      `The compiler module could not be loaded (${
        error instanceof Error ? error.message : String(error)
      }). ` +
      "If you are running the playground locally, build the assets first: pnpm build:playground"
    unavailable.hidden = false
  })
