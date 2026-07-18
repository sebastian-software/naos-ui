import { Show, state } from "@naos-ui/core"

export function ShowBooleanFallback() {
  const ready = state(false)

  return (
    <section>
      <Show when={ready()} fallback>
        <span>Ready</span>
      </Show>
    </section>
  )
}
