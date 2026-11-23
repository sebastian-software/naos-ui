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
  createNaosAccordionController,
  parseNaosAccordionValue,
  syncNaosAccordionItems,
  type NaosAccordionController,
} from "./internal/behavior/accordion.js"
import css from "./accordion.wc.css?inline"

export type NaosAccordionProps = {
  collapsible?: boolean
  disabled?: boolean
  label?: string
  multiple?: boolean
  orientation?: "horizontal" | "vertical"
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosAccordion({
  collapsible = true,
  disabled = false,
  label = "Sections",
  multiple = false,
  orientation = "vertical",
  value = "",
}: NaosAccordionProps = {}) {
  const selected = state(parseNaosAccordionValue(value))
  const controller = state<NaosAccordionController | null>(null)
  const changed = event<{ value: string[] }>("naos-change")

  onConnected(() => {
    controller.set(
      createNaosAccordionController({
        id: "naos-accordion",
        collapsible,
        defaultValue: selected(),
        disabled,
        multiple,
        onValueChange(nextValue) {
          selected.set(nextValue)
          changed.emit({ value: nextValue })
        },
      }),
    )
  })
  onDisconnected(() => {
    controller()?.destroy()
    controller.set(null)
  })
  effect(() => {
    const instance = controller()
    void selected()
    if (instance == null) return
    return syncNaosAccordionItems({
      api: instance.api,
      disabled,
      host: host().element,
      onRequestUpdate: () => host().update(),
    })
  })

  return (
    <section
      id="accordion:naos-accordion"
      data-scope="accordion"
      data-part="root"
      part="root"
      aria-disabled={disabled || undefined}
      data-disabled={disabled || undefined}
      data-orientation={orientation}
      data-state={selected().join(" ") || "none"}
    >
      <span part="label">{label}</span>
      <div part="items">
        <slot />
      </div>
    </section>
  )
}
