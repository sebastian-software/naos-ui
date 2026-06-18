import { event, on, state, type ComponentOptions } from "@iktia/core"
import { tabsValueForKey } from "./internal/behavior/tabs.js"
import css from "./tabs.wc.css?inline"

export type IktiaTabsProps = {
  firstLabel?: string
  orientation?: "horizontal" | "vertical"
  secondLabel?: string
  thirdLabel?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaTabs({
  firstLabel = "First",
  orientation = "horizontal",
  secondLabel = "Second",
  thirdLabel = "Third",
}: IktiaTabsProps = {}) {
  const selected = state("first")
  const changed = event<{ value: string }>("iktia-change")

  return (
    <section part="root" data-state={selected()} data-orientation={orientation}>
      <div part="tablist" role="tablist" aria-orientation={orientation}>
        <button
          id="iktia-tab-first"
          part="tab"
          role="tab"
          type="button"
          aria-selected={selected() === "first"}
          aria-controls="iktia-panel-first"
          data-state={selected() === "first" ? "selected" : "unselected"}
          tabindex={selected() === "first" ? 0 : -1}
          onKeyDown={on("keydown", (event) => {
            const next = tabsValueForKey(selected(), event.key, ["first", "second", "third"], orientation)
            if (next == null) return
            event.preventDefault()
            selected.set(next)
            changed.emit({ value: selected() })
            const current = event.currentTarget
            if (!(current instanceof HTMLElement)) return
            const root = current.getRootNode()
            if (!(root instanceof ShadowRoot)) return
            const tab = root.getElementById(`iktia-tab-${next}`)
            if (tab instanceof HTMLElement) tab.focus()
          })}
          onClick={on("click", () => {
            selected.set("first")
            changed.emit({ value: selected() })
          })}
        >
          {firstLabel}
        </button>
        <button
          id="iktia-tab-second"
          part="tab"
          role="tab"
          type="button"
          aria-selected={selected() === "second"}
          aria-controls="iktia-panel-second"
          data-state={selected() === "second" ? "selected" : "unselected"}
          tabindex={selected() === "second" ? 0 : -1}
          onKeyDown={on("keydown", (event) => {
            const next = tabsValueForKey(selected(), event.key, ["first", "second", "third"], orientation)
            if (next == null) return
            event.preventDefault()
            selected.set(next)
            changed.emit({ value: selected() })
            const current = event.currentTarget
            if (!(current instanceof HTMLElement)) return
            const root = current.getRootNode()
            if (!(root instanceof ShadowRoot)) return
            const tab = root.getElementById(`iktia-tab-${next}`)
            if (tab instanceof HTMLElement) tab.focus()
          })}
          onClick={on("click", () => {
            selected.set("second")
            changed.emit({ value: selected() })
          })}
        >
          {secondLabel}
        </button>
        <button
          id="iktia-tab-third"
          part="tab"
          role="tab"
          type="button"
          aria-selected={selected() === "third"}
          aria-controls="iktia-panel-third"
          data-state={selected() === "third" ? "selected" : "unselected"}
          tabindex={selected() === "third" ? 0 : -1}
          onKeyDown={on("keydown", (event) => {
            const next = tabsValueForKey(selected(), event.key, ["first", "second", "third"], orientation)
            if (next == null) return
            event.preventDefault()
            selected.set(next)
            changed.emit({ value: selected() })
            const current = event.currentTarget
            if (!(current instanceof HTMLElement)) return
            const root = current.getRootNode()
            if (!(root instanceof ShadowRoot)) return
            const tab = root.getElementById(`iktia-tab-${next}`)
            if (tab instanceof HTMLElement) tab.focus()
          })}
          onClick={on("click", () => {
            selected.set("third")
            changed.emit({ value: selected() })
          })}
        >
          {thirdLabel}
        </button>
      </div>
      <div
        id="iktia-panel-first"
        part="panel"
        role="tabpanel"
        data-value="first"
        aria-labelledby="iktia-tab-first"
      >
        <slot name="first" />
      </div>
      <div
        id="iktia-panel-second"
        part="panel"
        role="tabpanel"
        data-value="second"
        aria-labelledby="iktia-tab-second"
      >
        <slot name="second" />
      </div>
      <div
        id="iktia-panel-third"
        part="panel"
        role="tabpanel"
        data-value="third"
        aria-labelledby="iktia-tab-third"
      >
        <slot name="third" />
      </div>
    </section>
  )
}
