export function selectionArrowStep(
  key: string,
  orientation: "horizontal" | "vertical",
  element: HTMLElement,
): number {
  if (orientation === "vertical") {
    if (key === "ArrowDown") return 1
    if (key === "ArrowUp") return -1
    return 0
  }
  if (key !== "ArrowLeft" && key !== "ArrowRight") return 0
  const rtl = getComputedStyle(element).direction === "rtl"
  return (key === "ArrowRight") !== rtl ? 1 : -1
}
