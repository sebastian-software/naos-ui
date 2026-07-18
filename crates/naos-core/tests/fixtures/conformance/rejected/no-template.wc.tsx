import { state } from "@naos-ui/core"

export function NoTemplate() {
  const count = state(0)
  void count
}
