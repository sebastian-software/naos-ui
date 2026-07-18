import "./app.css"
import "./board.wc.tsx"
import "./task-detail.wc.tsx"

import { fetchResource, type NaosResource } from "@naos-ui/data"
import { createRouter, defineRoutes } from "@naos-ui/router"

import { fetchTask, type Task } from "./api.ts"

function resolveResource<Data>(resource: NaosResource<Data>): Promise<Data> {
  const snapshot = resource.snapshot()
  if (snapshot.status === "success" && !snapshot.stale) {
    return Promise.resolve(snapshot.data)
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = resource.subscribe(() => {
      const current = resource.snapshot()
      if (current.status === "success") {
        unsubscribe()
        resolve(current.data)
      } else if (current.status === "error") {
        unsubscribe()
        reject(current.error instanceof Error ? current.error : new Error(String(current.error)))
      }
    })
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

const router = createRouter({
  outlet,
  routes,
})

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
