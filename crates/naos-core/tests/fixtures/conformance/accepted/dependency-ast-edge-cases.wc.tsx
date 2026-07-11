import { computed, state } from "@naos-ui/core"

export function DependencyAstEdgeCases() {
  const count = state(0)
  const label = state("Alpha")
  const items = computed(() => [{ id: "a", label: label() }])

  return (
    <section
      data-combined={`${label()}-${/a{2}/.test("aa") ? count() : 0}`}
      data-count={count() /* label() in a comment is not a dependency */}
    >
      {items().map((item) => (
        <span key={item.id} data-label={item.label}>
          {item.label}: {count()}
        </span>
      ))}
    </section>
  )
}
