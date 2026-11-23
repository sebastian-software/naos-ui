import {
  effect,
  event,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import {
  createNaosTabsController,
  firstCustomTabValue,
  getLegacyTabProps,
  hasCustomTabs,
  syncNaosTabsItems,
  type NaosTabsController,
} from "./internal/behavior/tabs-sdk.js"
import css from "./tabs.wc.css?inline"

export type NaosTabsProps = {
  firstLabel?: string
  orientation?: "horizontal" | "vertical"
  secondLabel?: string
  thirdLabel?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosTabs({
  firstLabel = "First",
  orientation = "horizontal",
  secondLabel = "Second",
  thirdLabel = "Third",
  value = "",
}: NaosTabsProps = {}) {
  const selected = state(value || "first")
  const customTabs = state(false)
  const childObserver = state<MutationObserver | null>(null)
  const controller = state<NaosTabsController | null>(null)
  const changed = event<{ value: string }>("naos-change")

  onConnected(() => {
    const hostElement = host().element
    const updateHasCustomTabs = () => {
      customTabs.set(hasCustomTabs(hostElement))
    }
    const initialValue = value || firstCustomTabValue(hostElement) || "first"
    selected.set(initialValue)
    updateHasCustomTabs()
    const observer = new MutationObserver(updateHasCustomTabs)
    observer.observe(hostElement, { childList: true, subtree: true })
    childObserver.set(observer)
    controller.set(
      createNaosTabsController({
        id: "naos-tabs",
        onValueChange(value) {
          if (value == null) return
          selected.set(value)
          changed.emit({ value })
        },
        orientation,
        defaultValue: initialValue,
      }),
    )
  })
  onDisconnected(() => {
    childObserver()?.disconnect()
    childObserver.set(null)
    controller()?.destroy()
    controller.set(null)
  })
  effect(() => {
    const api = controller()?.api
    void selected()
    if (api == null || !customTabs()) return
    return syncNaosTabsItems({
      api,
      host: host().element,
      onRequestUpdate: () => host().update(),
      orientation,
    })
  })

  return (
    <section
      id="tabs:naos-tabs"
      data-scope="tabs"
      data-part="root"
      part="root"
      data-state={selected()}
      data-orientation={orientation}
      data-mode={customTabs() ? "custom" : "legacy"}
    >
      <div
        role="tablist"
        data-scope="tabs"
        data-part="list"
        part="tablist legacy"
        aria-orientation={orientation}
      >
        <button
          {...getLegacyTabProps({
            api: controller()?.api,
            orientation,
            selected: selected(),
            value: "first",
          })}
          part="tab"
          data-state={selected() === "first" ? "selected" : "unselected"}
        >
          {firstLabel}
        </button>
        <button
          {...getLegacyTabProps({
            api: controller()?.api,
            orientation,
            selected: selected(),
            value: "second",
          })}
          part="tab"
          data-state={selected() === "second" ? "selected" : "unselected"}
        >
          {secondLabel}
        </button>
        <button
          {...getLegacyTabProps({
            api: controller()?.api,
            orientation,
            selected: selected(),
            value: "third",
          })}
          part="tab"
          data-state={selected() === "third" ? "selected" : "unselected"}
        >
          {thirdLabel}
        </button>
      </div>
      <div
        role="tablist"
        data-scope="tabs"
        data-part="list"
        part="tablist custom"
        aria-orientation={orientation}
      >
        <slot name="tab" />
      </div>
      <div
        id="tabs:naos-tabs:content-first"
        role="tabpanel"
        aria-labelledby="tabs:naos-tabs:trigger-first"
        tabindex={0}
        data-selected={selected() === "first" || undefined}
        hidden={selected() !== "first"}
        data-scope="tabs"
        data-part="content"
        data-orientation={orientation}
        part="panel legacy"
        data-value="first"
      >
        <slot name="first" />
      </div>
      <div
        id="tabs:naos-tabs:content-second"
        role="tabpanel"
        aria-labelledby="tabs:naos-tabs:trigger-second"
        tabindex={0}
        data-selected={selected() === "second" || undefined}
        hidden={selected() !== "second"}
        data-scope="tabs"
        data-part="content"
        data-orientation={orientation}
        part="panel legacy"
        data-value="second"
      >
        <slot name="second" />
      </div>
      <div
        id="tabs:naos-tabs:content-third"
        role="tabpanel"
        aria-labelledby="tabs:naos-tabs:trigger-third"
        tabindex={0}
        data-selected={selected() === "third" || undefined}
        hidden={selected() !== "third"}
        data-scope="tabs"
        data-part="content"
        data-orientation={orientation}
        part="panel legacy"
        data-value="third"
      >
        <slot name="third" />
      </div>
      <div part="panels custom">
        <slot name="panel" />
      </div>
    </section>
  )
}
