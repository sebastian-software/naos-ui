import { host, onDisconnected, state } from "@naos-ui/core"
import { createTypeahead, isTypeaheadKey, labelOf } from "@ui-sdk/core"

export function LabJumpList({ label = "Destinations" }: { label?: string } = {}) {
  const search = state(createTypeahead())
  onDisconnected(() => search().reset())

  return (
    <div
      role="group"
      aria-label={label}
      onKeyDown={(event) => {
        if (!(event instanceof KeyboardEvent) || !isTypeaheadKey(event)) return
        const buttons = Array.from(
          host().element.querySelectorAll<HTMLButtonElement>(":scope > button:enabled"),
        )
        const current = buttons.indexOf(event.target as HTMLButtonElement)
        if (current < 0) return
        const next = search()(event.key, buttons.map(labelOf), current)
        if (next < 0) return
        event.preventDefault()
        buttons[next].focus()
      }}
    >
      <slot />
    </div>
  )
}
