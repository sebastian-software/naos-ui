import { effect } from "@naos-ui/core"

export type EffectLifecycleItemProps = {
  lifecycleId?: string
}

export function EffectLifecycleItem({
  lifecycleId = "unknown",
}: EffectLifecycleItemProps = {}) {
  effect(() => {
    const incrementAttribute = (name: string) => {
      const current = Number(document.body.getAttribute(name) ?? "0")
      document.body.setAttribute(name, String(current + 1))
    }
    incrementAttribute(`data-lifecycle-runs-${lifecycleId}`)
    const onProbe = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail !== lifecycleId) return
      incrementAttribute(`data-lifecycle-hits-${lifecycleId}`)
    }
    window.addEventListener("naos-lifecycle-probe", onProbe)

    return () => {
      window.removeEventListener("naos-lifecycle-probe", onProbe)
      incrementAttribute(`data-lifecycle-cleanups-${lifecycleId}`)
    }
  })

  return <span data-lifecycle-id={lifecycleId}>{lifecycleId}</span>
}
