import { defineQuery, useQuery } from '@pinia/colada'
import { apiClient } from '~~/shared/api-client'
import type { Ok } from '~~/shared/api-client'
import type { components } from '~~/shared/api-client/schema'

// User shape comes straight from the generated contract — no hand-maintained
// duplicate. Regenerate with `pnpm openapi-types` when the backend changes.
export type User = components['schemas']['User']

export const userQueries = {
  list: {
    key: ['users', 'list'],
    // Goes through the same-origin BFF proxy (apiClient's baseURL '/api/backend'):
    // the proxy attaches the Bearer token and handles token refresh. This query
    // never sees a token or NUXT_BACKEND_URL. $fetch throws on non-2xx, so the
    // failure path needs no branch here — Colada surfaces it as `error`.
    query: async (): Promise<User[]> => {
      const { data } = await apiClient<Ok<'/v1/users'>>('/v1/users')
      return data
    }
  }
}

// Shared across every consumer (defineQuery, not a Pinia store — Colada already owns the cache).
export const useUsers = defineQuery(() => useQuery(userQueries.list))
