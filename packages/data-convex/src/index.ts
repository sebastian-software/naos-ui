import {
  NaosResourceCache,
  type NaosResource,
  type NaosResourceKey,
  defaultNaosResourceCache,
  normalizeResourceKey,
  subscriptionResource,
} from "@naos-ui/data"
import { getFunctionName } from "convex/server"
import type { ConnectionState, MutationOptions } from "convex/browser"
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from "convex/server"

export type NaosConvexUnsubscribe<Data> = {
  (): void
  unsubscribe(): void
  getCurrentValue(): Data | undefined
}

export type NaosConvexQueryClient = {
  onUpdate<Query extends FunctionReference<"query">>(
    query: Query,
    args: FunctionArgs<Query>,
    callback: (result: FunctionReturnType<Query>) => unknown,
    onError?: (error: Error) => unknown
  ): NaosConvexUnsubscribe<FunctionReturnType<Query>>
}

export type NaosConvexMutationClient = {
  mutation<Mutation extends FunctionReference<"mutation">>(
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
    options?: MutationOptions
  ): Promise<Awaited<FunctionReturnType<Mutation>>>
}

export type NaosConvexActionClient = {
  action<Action extends FunctionReference<"action">>(
    action: Action,
    args: FunctionArgs<Action>
  ): Promise<Awaited<FunctionReturnType<Action>>>
}

export type NaosConvexConnectionClient = {
  connectionState(): ConnectionState
  subscribeToConnectionState(callback: (connectionState: ConnectionState) => void): () => void
}

export type NaosConvexResourceOptions<Data> = {
  cache?: NaosResourceCache
  initialData?: Data
  key?: NaosResourceKey
}

export type NaosConvexConnectionResourceOptions = {
  cache?: NaosResourceCache
  initialData?: ConnectionState
  key?: NaosResourceKey
}

export function convexResource<Query extends FunctionReference<"query">>(
  client: NaosConvexQueryClient,
  query: Query,
  args: FunctionArgs<Query> | "skip",
  options: NaosConvexResourceOptions<FunctionReturnType<Query>> = {}
): NaosResource<FunctionReturnType<Query>, Error> {
  if (args === "skip") {
    return subscriptionResource(null, () => () => {}, { cache: options.cache })
  }

  const resourceKey = options.key ?? convexQueryKey(query, args)
  return subscriptionResource<FunctionReturnType<Query>, NaosResourceKey, Error>(
    resourceKey,
    (_key, { next }) => {
      const unsubscribe = client.onUpdate(
        query,
        args,
        (result) => next(null, result),
        (error) => next(error)
      )

      const current = unsubscribe.getCurrentValue()
      if (current !== undefined) {
        next(null, current)
      }

      return () => unsubscribeConvex(unsubscribe)
    },
    {
      cache: options.cache,
      initialData: options.initialData,
    }
  )
}

export function convexQueryKey<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>
): string {
  const normalized = normalizeResourceKey(["convex", getFunctionName(query), args])
  if (normalized.disabled) {
    throw new Error("Convex query keys cannot be disabled.")
  }
  return normalized.key
}

export function convexMutation<Mutation extends FunctionReference<"mutation">>(
  client: NaosConvexMutationClient,
  mutation: Mutation,
  options?: MutationOptions
): (...args: OptionalRestArgs<Mutation>) => Promise<Awaited<FunctionReturnType<Mutation>>> {
  return (...args) => client.mutation(mutation, (args[0] ?? {}) as FunctionArgs<Mutation>, options)
}

export function convexAction<Action extends FunctionReference<"action">>(
  client: NaosConvexActionClient,
  action: Action
): (...args: OptionalRestArgs<Action>) => Promise<Awaited<FunctionReturnType<Action>>> {
  return (...args) => client.action(action, (args[0] ?? {}) as FunctionArgs<Action>)
}

export function convexConnectionResource(
  client: NaosConvexConnectionClient,
  options: NaosConvexConnectionResourceOptions = {}
): NaosResource<ConnectionState, Error> {
  const cache = options.cache ?? defaultNaosResourceCache
  return subscriptionResource<ConnectionState, NaosResourceKey, Error>(
    options.key ?? "convex:connection",
    (_key, { next }) => {
      try {
        next(null, client.connectionState())
      } catch (error) {
        next(normalizeError(error))
      }

      return client.subscribeToConnectionState((connectionState) => next(null, connectionState))
    },
    {
      cache,
      initialData: options.initialData,
    }
  )
}

function unsubscribeConvex(unsubscribe: NaosConvexUnsubscribe<unknown>): void {
  unsubscribe.unsubscribe()
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
