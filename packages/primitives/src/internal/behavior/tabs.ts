export type TabsOrientation = "horizontal" | "vertical"

export function tabsValueForKey(
  current: string,
  key: string,
  values: readonly string[],
  orientation: TabsOrientation = "horizontal"
): string | null {
  if (values.length === 0) return null

  if (key === "Home") return values[0] ?? null
  if (key === "End") return values[values.length - 1] ?? null

  const forwardKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight"
  const backwardKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft"
  if (key !== forwardKey && key !== backwardKey) return null

  const currentIndex = Math.max(0, values.indexOf(current))
  const offset = key === forwardKey ? 1 : -1
  const nextIndex = (currentIndex + offset + values.length) % values.length
  return values[nextIndex] ?? null
}
