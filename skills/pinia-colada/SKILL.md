---
name: pinia-colada
description: >
  Pinia Colada (@pinia/colada) — the official async data-fetching layer for Vue 3 built on Pinia.
  Use when fetching data with useQuery/useMutation, defining reusable queries with defineQuery,
  managing the query cache with useQueryCache, implementing optimistic updates, configuring SSR
  data fetching, setting up caching strategy (staleTime, gcTime), invalidating queries after
  mutations, or using retry/auto-refetch plugins. Also triggers for any mention of
  @pinia/colada, pinia-colada, query caching in Vue, or async state with Pinia.
metadata:
  version: "2026.6.19"
  source: https://pinia-colada.esm.dev
---

# Pinia Colada

`@pinia/colada` is the official async/data-fetching layer for Vue 3. It provides automatic
client-side caching with request deduplication, stale-while-revalidate, garbage collection,
mutations with lifecycle hooks, optimistic updates, and SSR support. ~2kb, zero deps beyond Pinia.

## Installation

```bash
pnpm add @pinia/colada @pinia/colada-nuxt
```

## Setup

```ts
// main.ts
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'

app.use(createPinia())
app.use(PiniaColada, {
  queryOptions: { staleTime: 5000 },   // global defaults
  mutationOptions: { onError(err) { } },
  plugins: [PiniaColadaQueryHooksPlugin({ onError(...) { } })],
})
```

```ts
// nuxt.config.ts — add module, configure in colada.options.ts
modules: ['@pinia/colada-nuxt']
```

## Core References

| Topic | Description | Reference |
|-------|-------------|-----------|
| Queries | `useQuery`, `defineQuery`, `defineQueryOptions`, key patterns | [core-query](references/core-query.md) |
| Mutations | `useMutation`, `defineMutation`, lifecycle hooks | [core-mutation](references/core-mutation.md) |
| Cache | `useQueryCache`, invalidation, key factories, filters | [cache.md](references/cache.md) |
| Patterns | Optimistic updates, SSR, TypeScript, plugins | [patterns.md](references/patterns.md) |

## Status Model

| `status` | `asyncStatus` | meaning |
|----------|---------------|---------|
| `'pending'` | `'idle'` | no data yet, not fetching |
| `'pending'` | `'loading'` | first fetch in-flight |
| `'success'` | `'idle'` | fresh data, not fetching |
| `'success'` | `'loading'` | background refetch |
| `'error'` | `'idle'` | fetch failed, previous data preserved |

Use `status` to decide what to render; use `asyncStatus === 'loading'` for spinners.

## Key Rules (always apply)

- Keys are arrays — `['todos', id]` is a child of `['todos']`; invalidating parent cascades.
- **Dynamic keys must use a getter**: `key: () => ['todos', route.params.id]` — static evaluation loses reactivity.
- Include every reactive variable used inside `query` in the `key` — omitting one causes stale data bugs.
- Object key order doesn't matter; array order does. `'2' !== 2`.
- Prefer `onSettled` over `onSuccess` for cache invalidation — it runs even when the mutation errors.
