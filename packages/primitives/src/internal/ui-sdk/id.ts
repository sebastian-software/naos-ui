let nextId = 0

export function primitiveId(name: string) {
  return `naos-${name}-${++nextId}`
}
