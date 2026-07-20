import { useEffect, useRef } from "react"

import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { javascript } from "@codemirror/lang-javascript"
import { bracketMatching, indentOnInput } from "@codemirror/language"
import { EditorState } from "@codemirror/state"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView, keymap, lineNumbers } from "@codemirror/view"

type CodeEditorProps = {
  /** Initial and externally-controlled document text. */
  value: string
  onChange: (value: string) => void
  /** Invoked on Mod-Enter, the playground's compile shortcut. */
  onSubmit: () => void
  ariaLabel: string
}

/**
 * CodeMirror-based TSX editor. The parent owns the source string; the editor
 * only pushes edits outward and re-syncs when the parent value diverges
 * (for example when a sample is loaded programmatically).
 */
export function CodeEditor({ value, onChange, onSubmit, ariaLabel }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const callbacksRef = useRef({ onChange, onSubmit })
  callbacksRef.current = { onChange, onSubmit }

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          javascript({ jsx: true, typescript: true }),
          oneDark,
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                callbacksRef.current.onSubmit()
                return true
              },
            },
            // Tab indents (indentWithTab below); Escape blurs the editor so
            // keyboard-only users can Tab onward instead of being trapped.
            {
              key: "Escape",
              run: (currentView) => {
                currentView.contentDOM.blur()
                return true
              },
            },
          ]),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              callbacksRef.current.onChange(update.state.doc.toString())
            }
          }),
          EditorView.theme({
            "&": { fontSize: "0.85rem" },
            ".cm-content": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
            ".cm-gutters": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      viewRef.current = null
      view.destroy()
    }
    // The editor is created once; `value` divergence is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={containerRef} className="naos-playground-editor" aria-label={ariaLabel} />
}
