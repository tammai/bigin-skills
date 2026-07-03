import { defineQuery, defineQueryOptions, useQuery } from '@pinia/colada'

export const userQueries = {
  list: defineQueryOptions({
    key: ['users', 'list'],
    query: () => $fetch('/api/users')
  })
}

// Shared across every consumer (defineQuery, not a Pinia store — Colada already owns the cache).
export const useUsers = defineQuery(() => useQuery(userQueries.list))
