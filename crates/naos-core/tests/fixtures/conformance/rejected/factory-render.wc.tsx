import { state } from "@naos-ui/core"

export function FactoryRender() {
  const count = state(0)

  return () => <button>{count()}</button>
}
