export type Task = {
  id: string
  title: string
  owner: string
  status: "open" | "done"
  summary: string
}

const TASKS: Task[] = [
  {
    id: "ship-router",
    title: "Ship typed router params",
    owner: "Mara",
    status: "done",
    summary: "Thread path params through loaders, actions, and matches.",
  },
  {
    id: "cache-eviction",
    title: "Evict idle resource cache entries",
    owner: "Jonas",
    status: "done",
    summary: "Keep-alive windows plus manual delete and clear controls.",
  },
  {
    id: "testing-harness",
    title: "Adopt the component test harness",
    owner: "Aylin",
    status: "open",
    summary: "Migrate probe-attribute tests to @naos-ui/testing mounts.",
  },
  {
    id: "motion-pass",
    title: "Motion pass over list surfaces",
    owner: "Mara",
    status: "open",
    summary: "FLIP reorders and reduced-motion aware presence transitions.",
  },
]

const NETWORK_DELAY_MS = 30

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function fetchTaskList(): Promise<Task[]> {
  await delay(NETWORK_DELAY_MS)
  return TASKS.map((task) => ({ ...task }))
}

export async function fetchTask(id: string): Promise<Task> {
  await delay(NETWORK_DELAY_MS)
  const task = TASKS.find((entry) => entry.id === id)
  if (!task) {
    throw new Error(`Unknown task "${id}".`)
  }
  return { ...task }
}

const ACTIVITY: string[] = [
  "Mara moved “Ship typed router params” to done.",
  "Jonas commented on “Evict idle resource cache entries”.",
  "Aylin picked up “Adopt the component test harness”.",
  "Mara opened “Motion pass over list surfaces”.",
]

const ACTIVITY_FEED_LIMIT = 6

export function subscribeToActivity(onEntry: (entries: string[]) => void): () => void {
  const seen: string[] = []
  let sequence = 0
  const timer = setInterval(() => {
    const entry = ACTIVITY[sequence % ACTIVITY.length]
    sequence += 1
    if (entry) {
      seen.push(`#${sequence} ${entry}`)
      if (seen.length > ACTIVITY_FEED_LIMIT) {
        seen.splice(0, seen.length - ACTIVITY_FEED_LIMIT)
      }
      onEntry([...seen])
    }
  }, 150)
  return () => clearInterval(timer)
}

export function filterTasks(tasks: Task[], filter: string): Task[] {
  if (filter === "all") {
    return tasks
  }
  return tasks.filter((task) => task.status === filter)
}

export const EMPTY_TASKS: Task[] = []

export const EMPTY_ACTIVITY: string[] = []
