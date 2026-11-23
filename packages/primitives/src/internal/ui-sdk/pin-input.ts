export type NaosPinInputType = "alphanumeric" | "alphabetic" | "numeric"
export function pinSlots(count: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => index)
}
export function pinPattern(type: NaosPinInputType): RegExp {
  if (type === "numeric") return /^[0-9]$/
  if (type === "alphabetic") return /^[A-Za-z]$/
  return /^[A-Za-z0-9]$/
}

export function pinKeyAction(key: string, slot: number, value: string, count: number) {
  const previous = Math.max(0, slot - 1)
  switch (key) {
    case "Backspace":
    case "Delete": {
      const remove = key === "Backspace" && !value[slot] ? previous : slot
      return {
        focus: key === "Backspace" ? previous : slot,
        value: value.slice(0, remove) + value.slice(remove + 1),
      }
    }
    case "ArrowLeft":
      return { focus: previous, value }
    case "ArrowRight":
      return { focus: Math.min(slot + 1, value.length, count - 1), value }
    case "Home":
      return { focus: 0, value }
    case "End":
      return { focus: Math.max(0, Math.min(value.length, count) - 1), value }
    default:
      return null
  }
}
