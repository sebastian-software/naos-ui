import { effect, state } from "@naos-ui/core"

export function EffectBlockCallback() {
  const count = state(0)

  effect(function tick() {
    void count()
  })

  return <span>{count()}</span>
}
