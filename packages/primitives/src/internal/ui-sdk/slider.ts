// The SDK hides the native range input inline. Naos exposes that input as its
// public thumb part, so keep it visible and styleable while the SDK positions
// its surrounding thumb element.
export function exposeSliderThumb(root: ParentNode): () => void {
  const input = root.querySelector<HTMLInputElement>("[part~='thumb']")
  if (!input) return () => {}
  const sync = () => {
    for (const property of [
      "opacity",
      "clip-path",
      "overflow",
      "white-space",
      "border",
      "padding",
    ]) {
      if (input.style.getPropertyValue(property)) input.style.removeProperty(property)
    }
  }
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(input, { attributes: true, attributeFilter: ["style"] })
  return () => observer.disconnect()
}
