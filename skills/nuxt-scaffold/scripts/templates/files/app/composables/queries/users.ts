import { defineQuery, useQuery } from '@pinia/colada'
import { apiClient } from '~~/shared/api-client'
import type { components } from '~~/shared/api-client/schema'

// User shape comes straight from the generated contract — no hand-maintained
// duplicate. Regenerate with `pnpm openapi-types` when the backend changes.
export type User = components['schemas']['User']

export const userQueries = {
  list: {
    key: ['users', 'list'],
    // Goes through the same-origin BFF proxy (apiClient's baseUrl '/api/backend'):
    // the proxy attaches the Bearer token and handles token refresh. This query
    // never sees a token or NUXT_BACKEND_URL.
    query: async (): Promise<User[]> => {
      const { data, error } = await apiClient.GET('/v1/users')
      if (error || !data) throw new Error('failed to fetch users')
      return data.data
    }
  }
}

// Shared across every consumer (defineQuery, not a Pinia store — Colada already owns the cache).
export const useUsers = defineQuery(() => useQuery(userQueries.list))
