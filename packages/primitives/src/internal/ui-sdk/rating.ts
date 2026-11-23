export function ratingItems(count: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => index + 1)
}

export function ratingKeyboardValue(
  key: string,
  current: number,
  count: number,
  half: boolean,
  item: number,
): number | null {
  const step = half ? 0.5 : 1
  if (key === "ArrowLeft" || key === "ArrowDown") return Math.max(1, current - step)
  if (key === "ArrowRight" || key === "ArrowUp") return Math.min(count, current + step)
  if (key === "Home") return 1
  if (key === "End") return count
  if (key === " " || key === "Spacebar" || key === "Space") return item
  return null
}
