import { effect, host, on, state } from "@naos-ui/core"

export function ReactivityProbe() {
  const primary = state(0)
  const secondary = state(0)
  const shouldThrow = state(false)

  effect(() => {
    const runs = Number(document.body.dataset.probeEffectRuns ?? "0") + 1
    document.body.dataset.probeEffectRuns = String(runs)
    document.body.dataset.probeEffectValue = String(primary())
  })

  effect(() => {
    if (shouldThrow()) {
      throw new Error("intentional lifecycle probe failure")
    }
  })

  return (
    <section part="root">
      <span data-probe-primary>{primary()}</span>
      <span data-probe-secondary>{secondary()}</span>
      <button
        data-probe-primary-button
        onClick={() => {
          primary.set(primary() + 1)
        }}
      >
        Primary
      </button>
      <button
        data-probe-equal-button
        onClick={() => {
          primary.set(primary())
        }}
      >
        Equal
      </button>
      <button
        data-probe-secondary-button
        onClick={() => {
          secondary.set(secondary() + 1)
        }}
      >
        Secondary
      </button>
      <button
        data-probe-batch-button
        onClick={() => {
          primary.set(primary() + 1)
          primary.set(primary() + 1)
        }}
      >
        Batch
      </button>
      <button
        data-probe-flush-button
        onClick={() => {
          primary.set(primary() + 1)
          const primaryNode = host().root.querySelector("[data-probe-primary]")
          document.body.dataset.probeBeforeFlush =
            primaryNode?.textContent ?? ""
          host().flushSync()
          document.body.dataset.probeAfterFlush =
            primaryNode?.textContent ?? ""
        }}
      >
        Flush
      </button>
      <button
        data-probe-error-button
        onClick={async () => {
          shouldThrow.set(true)
          host().queueTask(() => {
            document.body.dataset.probeErrorQueuedTask = "true"
          })
          await host().update()
          document.body.dataset.probeErrorUpdateSettled = "true"
        }}
      >
        Trigger error
      </button>
      <button
        data-probe-recover-button
        onClick={() => {
          shouldThrow.set(false)
          primary.set(primary() + 1)
        }}
      >
        Recover
      </button>
      <button
        data-probe-event-signal-button
        onClick={on(async (_event, signal) => {
          const run = Number(document.body.dataset.probeEventRun ?? "0") + 1
          document.body.dataset.probeEventRun = String(run)
          document.body.dataset.probeEventSignalAborted = String(signal.aborted)
          signal.addEventListener(
            "abort",
            () => {
              const aborts =
                Number(document.body.dataset.probeEventAbortCount ?? "0") + 1
              document.body.dataset.probeEventAbortCount = String(aborts)
            },
            { once: true }
          )
          await new Promise((resolve) => setTimeout(resolve, 50))
          document.body.dataset.probeEventSignalAborted = String(signal.aborted)
          if (!signal.aborted) {
            document.body.dataset.probeEventCompletedRun = String(run)
          }
        })}
      >
        Event signal
      </button>
      <button
        data-probe-update-signal-button
        onClick={async () => {
          primary.set(primary() + 1)
          const updateSignal = await host().update()
          document.body.dataset.probeUpdateSignalAborted = String(
            updateSignal.aborted
          )
          updateSignal.addEventListener(
            "abort",
            () => {
              const aborts =
                Number(document.body.dataset.probeUpdateAbortCount ?? "0") + 1
              document.body.dataset.probeUpdateAbortCount = String(aborts)
            },
            { once: true }
          )
          host().queueTask(() => {
            const primaryNode = host().root.querySelector("[data-probe-primary]")
            document.body.dataset.probeQueuedTaskPrimary =
              primaryNode?.textContent ?? ""
          })
        }}
      >
        Update signal
      </button>
      <div
        onClick={() => {
          const order = document.body.dataset.probeEventOptionsOrder
          document.body.dataset.probeEventOptionsOrder = order
            ? `${order},bubble`
            : "bubble"
        }}
      >
        <button
          data-probe-event-options-button
          onClick={on((event) => {
            event.preventDefault()
            const order = document.body.dataset.probeEventOptionsOrder
            document.body.dataset.probeEventOptionsOrder = order
              ? `${order},capture`
              : "capture"
            document.body.dataset.probePassiveDefaultPrevented = String(
              event.defaultPrevented
            )
          }, { capture: true, passive: true, once: true })}
        >
          Event options
        </button>
      </div>
    </section>
  )
}
