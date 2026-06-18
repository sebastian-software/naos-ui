import {
  computed,
  event,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@iktia/core"
import {
  createIktiaZagTabsService,
  getIktiaZagTabsApi,
  stopIktiaZagTabsService,
} from "./internal/zag/tabs.js"
import type { IktiaZagTabsService } from "./internal/zag/tabs.js"
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
  const tabsService = state<IktiaZagTabsService | null>(null)
  const tabsApi = computed(() => getIktiaZagTabsApi(tabsService()))
  const changed = event<{ value: string }>("iktia-change")

  onConnected(() => {
    tabsService.set(createIktiaZagTabsService({
      host: host().element,
      id: "iktia-tabs",
      onValueChange(value) {
        if (value == null) return
        selected.set(value)
        changed.emit({ value })
      },
      orientation,
      root: host().root,
      value: selected(),
    }))
  })
  onDisconnected(() => {
    stopIktiaZagTabsService(tabsService())
    tabsService.set(null)
  })

  return (
    <section
      {...(tabsApi()?.getRootProps() ?? {})}
      part="root"
      data-state={selected()}
      data-orientation={orientation}
    >
      <div
        {...(tabsApi()?.getListProps() ?? {})}
        part="tablist"
        aria-orientation={orientation}
      >
        <button
          {...(tabsApi()?.getTriggerProps({ value: "first" }) ?? {})}
          part="tab"
          data-state={selected() === "first" ? "selected" : "unselected"}
        >
          {firstLabel}
        </button>
        <button
          {...(tabsApi()?.getTriggerProps({ value: "second" }) ?? {})}
          part="tab"
          data-state={selected() === "second" ? "selected" : "unselected"}
        >
          {secondLabel}
        </button>
        <button
          {...(tabsApi()?.getTriggerProps({ value: "third" }) ?? {})}
          part="tab"
          data-state={selected() === "third" ? "selected" : "unselected"}
        >
          {thirdLabel}
        </button>
      </div>
      <div
        {...(tabsApi()?.getContentProps({ value: "first" }) ?? {})}
        part="panel"
        data-value="first"
      >
        <slot name="first" />
      </div>
      <div
        {...(tabsApi()?.getContentProps({ value: "second" }) ?? {})}
        part="panel"
        data-value="second"
      >
        <slot name="second" />
      </div>
      <div
        {...(tabsApi()?.getContentProps({ value: "third" }) ?? {})}
        part="panel"
        data-value="third"
      >
        <slot name="third" />
      </div>
    </section>
  )
}
