import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { javascript } from "@codemirror/lang-javascript"
import { bracketMatching, indentOnInput } from "@codemirror/language"
import { EditorState } from "@codemirror/state"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView, keymap, lineNumbers } from "@codemirror/view"

export type PlaygroundEditor = {
  getValue: () => string
  setValue: (value: string) => void
}

/**
 * CodeMirror-based TSX editor for the standalone playground page.
 */
export function createEditor(options: {
  parent: HTMLElement
  doc: string
  onChange: (value: string) => void
  onSubmit: () => void
}): PlaygroundEditor {
  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
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
              options.onSubmit()
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
            options.onChange(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          "&": { fontSize: "0.85rem", height: "100%" },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          },
          ".cm-gutters": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
        }),
      ],
    }),
  })

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    },
  }
}
