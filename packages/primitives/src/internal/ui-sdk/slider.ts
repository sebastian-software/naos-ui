// The SDK hides the native range input inline. Naos exposes that input as its
// public thumb part, so keep it visible and styleable while the SDK positions
// its surrounding thumb element.
export function exposeSliderThumb(input: HTMLInputElement): () => void {
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
