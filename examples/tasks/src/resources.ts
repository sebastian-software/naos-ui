import { fetchResource, subscriptionResource } from "@naos-ui/data"

import { fetchTaskList, subscribeToActivity } from "./api.ts"

// Resources live at module scope until the data-layer lifecycle helper
// (issue #110) allows creating them inside component setup.
export const tasksResource = fetchResource(["tasks"], () => fetchTaskList())

export const activityResource = subscriptionResource<string[], string>(
  "activity",
  (_key, { next, signal }) => {
    const stop = subscribeToActivity((latest) => next(null, latest))
    signal.addEventListener("abort", () => stop(), { once: true })
    return () => stop()
  }
)
