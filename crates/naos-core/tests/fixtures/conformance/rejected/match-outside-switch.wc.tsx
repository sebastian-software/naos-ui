import { Match, state } from "@naos-ui/core"

export function MatchOutsideSwitch() {
  const ready = state(false)

  return (
    <section>
      <Match when={ready()}>
        <span>Ready</span>
      </Match>
    </section>
  )
}
