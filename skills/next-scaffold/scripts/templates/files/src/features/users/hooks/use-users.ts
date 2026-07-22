import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/shared/api-client'
import type { paths } from '@/shared/api-client/schema'

// User shape comes straight from the generated contract — no hand-maintained
// duplicate. The backend inlines its schemas (no components/$ref), so the type
// is derived from the list operation's 200 response. Regenerate the contract
// with `pnpm openapi:generate` when the backend changes.
type UsersListBody = paths['/v1/users/']['get']['responses'][200]['content']['application/json']
export type User = UsersListBody['data'][number]

export const userQueries = {
  list: {
    queryKey: ['users', 'list'] as const,
    queryFn: async (): Promise<User[]> => {
      // Goes through the same-origin BFF proxy (baseUrl '/api/backend'): the
      // proxy attaches the Bearer token and handles token refresh. This hook
      // never sees a token or BACKEND_URL.
      const { data, error } = await apiClient.GET('/v1/users/')
      if (error || !data) throw new Error('failed to fetch users')
      return data.data
    }
  }
}

// Shared across every consumer via TanStack Query's own cache — no separate store needed.
export function useUsers() {
  return useQuery(userQueries.list)
}
