// Lazy shiki highlighter for the playground's read-only generated-module
// view. Loaded on demand in the browser with the JavaScript regex engine so
// no oniguruma wasm ships with the route chunk, and cached across runs.
import type { HighlighterCore } from "shiki"

let highlighterPromise: Promise<HighlighterCore> | null = null

function loadHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, javascript, oneDarkPro] =
      await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
        import("@shikijs/langs/javascript"),
        import("@shikijs/themes/one-dark-pro"),
      ])
    return createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      langs: [javascript.default],
      themes: [oneDarkPro.default],
    })
  })().catch((error: unknown) => {
    // Do not cache a rejection - a transient load failure should retry on
    // the next highlight attempt instead of disabling highlighting forever.
    highlighterPromise = null
    throw error
  })
  return highlighterPromise
}

/** Highlights generated JavaScript as shiki HTML (one-dark-pro). */
export async function highlightGeneratedModule(code: string): Promise<string> {
  const highlighter = await loadHighlighter()
  return highlighter.codeToHtml(code, { lang: "javascript", theme: "one-dark-pro" })
}
