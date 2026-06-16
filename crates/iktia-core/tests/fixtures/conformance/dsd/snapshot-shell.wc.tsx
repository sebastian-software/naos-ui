import { state, type ComponentOptions } from "@iktia/core"
import css from "./snapshot-shell.css?inline"

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function SnapshotShell({ label = "Count" }: SnapshotShellProps = {}) {
  const count = state(0)

  return (
    <section part="root" data-count={count()} aria-label={label}>
      {`${label}: ${count()}`}
    </section>
  )
}
