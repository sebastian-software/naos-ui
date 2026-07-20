type TypedProps = {
  readonly disabled?: boolean
  count?: number
  label?: string
  items?: string[]
}

export function TypedProps({ disabled, count, label = "Typed", items = [] }: TypedProps = {}) {
  return (
    <section data-count={count} data-disabled={disabled}>
      <strong>{label}</strong>
      <span>{items.length}</span>
    </section>
  )
}
