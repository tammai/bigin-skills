import { defineQuery, defineQueryOptions, useQuery } from '@pinia/colada'

export const sessionQueries = {
  me: defineQueryOptions({
    key: ['session', 'me'],
    query: () => $fetch('/api/me'),
  }),
}

// Shared across every consumer (defineQuery, not a Pinia store — Colada already owns the cache).
export const useMe = defineQuery(() => useQuery(sessionQueries.me))
