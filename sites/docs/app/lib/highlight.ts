// Lazy shiki highlighter for the playground's read-only generated-module
// view. Loaded on demand in the browser with the JavaScript regex engine so
// no oniguruma wasm ships with the route chunk, and cached across runs.
import type { HighlighterCore } from "shiki"

let highlighterPromise: Promise<HighlighterCore> | null = null

async function loadHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [
      { createHighlighterCore },
      { createJavaScriptRegexEngine },
      { bundledThemes },
      { bundledLanguages },
    ] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("shiki/themes"),
      import("shiki/langs"),
    ])
    return createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      langs: [bundledLanguages.javascript],
      themes: [bundledThemes["one-dark-pro"]],
    })
  })()
  return highlighterPromise
}

/** Highlights generated JavaScript as shiki HTML (one-dark-pro). */
export async function highlightGeneratedModule(code: string): Promise<string> {
  const highlighter = await loadHighlighter()
  return highlighter.codeToHtml(code, { lang: "javascript", theme: "one-dark-pro" })
}
