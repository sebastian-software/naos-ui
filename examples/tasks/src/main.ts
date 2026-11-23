import "./app.css"
import "./board.wc.tsx"
import "./task-detail.wc.tsx"

import { fetchResource, type NaosResource } from "@naos-ui/data"
import { createRouter, defineRoutes } from "@naos-ui/router"

import { fetchTask, type Task } from "./api.ts"

function resolveResource<Data>(resource: NaosResource<Data>): Promise<Data> {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {}
    const settle = (): boolean => {
      const current = resource.snapshot()
      if (current.status === "success" && !current.stale) {
        unsubscribe()
        resolve(current.data)
        return true
      }
      if (current.status === "error") {
        unsubscribe()
        reject(current.error instanceof Error ? current.error : new Error(String(current.error)))
        return true
      }
      return false
    }

    if (settle()) {
      return
    }
    unsubscribe = resource.subscribe(() => settle())
    settle()
  })
}

function taskLoader(id: string): Promise<Task> {
  const resource = fetchResource(["task", id], ([, taskId]) => fetchTask(String(taskId)))
  return resolveResource(resource)
}

const outlet = document.querySelector("[data-app-outlet]")
if (!outlet) {
  throw new Error("Missing app outlet.")
}

const routes = defineRoutes([
  {
    path: "/",
    tag: "tasks-board",
    title: "Task board",
  },
  {
    path: "/tasks/:id",
    tag: "tasks-task-detail",
    loader: ({ params }) => taskLoader(params.id),
    props({ data, params }) {
      const task = data as Task | undefined
      return {
        taskId: params.id,
        taskOwner: task?.owner ?? "",
        taskStatus: task?.status ?? "open",
        taskSummary: task?.summary ?? "",
        taskTitle: task?.title ?? `Task ${params.id}`,
      }
    },
    title({ params }) {
      return `Task ${params.id} – Task board`
    },
  },
])

const snapshot = document.querySelector<HTMLScriptElement>("#naos-snapshot")?.textContent
const router = createRouter({
  outlet,
  routes,
  snapshot: snapshot ?? undefined,
  ...(import.meta.env.DEV
    ? {
        onSnapshotMismatch(reason) {
          console.warn("[Tasks] Snapshot mismatch", { reason, url: location.href })
        },
      }
    : {}),
})

// The resource error reaches the router unchanged. Correlate it with the
// navigation so a developer can find the failing loader and resource.
if (import.meta.env.DEV) {
  router.addEventListener("naos:navigationerror", (event) => {
    const { error, navigation } = (
      event as CustomEvent<{
        error: unknown
        navigation: { id: number; url: URL }
      }>
    ).detail
    const match = router.match(navigation.url)
    console.error("[Tasks] Navigation failed", {
      error,
      navigationId: navigation.id,
      resource: match?.route.path === "/tasks/:id" ? ["task", match.params.id] : undefined,
      route: match?.route.path,
      url: navigation.url.href,
    })
  })
}

outlet.addEventListener("naos-open-task", (openEvent) => {
  if (!(openEvent instanceof CustomEvent)) {
    return
  }
  const detail = openEvent.detail as { id?: string }
  if (detail?.id) {
    void router.navigate(router.href("/tasks/:id", { id: detail.id }))
  }
})

outlet.addEventListener("naos-back", () => {
  void router.navigate(router.href("/"))
})

router.start()
