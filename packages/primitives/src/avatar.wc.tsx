import { event, host, onConnected, state, type ComponentOptions } from "@naos-ui/core"
import css from "./avatar.wc.css?inline"

export type NaosAvatarProps = {
  alt?: string
  fallback?: string
  src?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosAvatar({ alt = "", fallback = "?", src = "" }: NaosAvatarProps = {}) {
  const status = state<"error" | "loaded">("error")
  const statusChanged = event<{ status: "error" | "loaded" }>("naos-status-change")

  onConnected(() => {
    const { root, signal } = host()
    const image = root.querySelector<HTMLImageElement>('[part~="image"]')
    if (!image) return

    let source = image.getAttribute("src")
    let reported: "error" | "loaded" | undefined
    const report = (next: "error" | "loaded") => {
      if (signal.aborted || reported === next) return
      reported = next
      status.set(next)
      statusChanged.emit({ status: next })
    }
    const checkImage = () => {
      if (signal.aborted) return
      const nextSource = image.getAttribute("src")
      if (source !== nextSource) {
        source = nextSource
        reported = undefined
      }
      if (source && !image.complete) status.set("error")
      else report(source && image.naturalWidth > 0 ? "loaded" : "error")
    }

    image.addEventListener("load", () => report("loaded"), { signal })
    image.addEventListener("error", () => report("error"), { signal })
    const observer = new MutationObserver(checkImage)
    observer.observe(image, { attributeFilter: ["src"] })
    signal.addEventListener("abort", () => observer.disconnect(), { once: true })
    queueMicrotask(checkImage)
  })

  return (
    <span
      id="avatar:naos-avatar"
      part="root"
      data-scope="avatar"
      data-part="root"
      data-state={status()}
    >
      <img
        id="avatar:naos-avatar:image"
        {...{ alt, src }}
        part="image"
        data-scope="avatar"
        data-part="image"
        data-state={status() === "loaded" ? "visible" : "hidden"}
        hidden={status() !== "loaded"}
      />
      <span
        id="avatar:naos-avatar:fallback"
        part="fallback"
        data-scope="avatar"
        data-part="fallback"
        data-state={status() === "loaded" ? "hidden" : "visible"}
        hidden={status() === "loaded"}
      >
        {fallback}
      </span>
    </span>
  )
}
