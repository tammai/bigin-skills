import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/shared/api-client'
import type { components } from '@/shared/api-client/schema'

// User shape comes straight from the generated contract (schemas.User) — no
// hand-maintained duplicate. Regenerate the contract types with
// `pnpm openapi:generate` when the backend changes.
export type User = components['schemas']['User']

export const userQueries = {
  profile: {
    queryKey: ['users', 'profile'] as const,
    queryFn: async (): Promise<User> => {
      // Goes through the same-origin BFF proxy (baseUrl '/api/backend/api/v1'):
      // the proxy attaches the Bearer token and handles token refresh. This hook
      // never sees a token or BACKEND_URL.
      const { data, error } = await apiClient.GET('/user/profile')
      if (error || !data) throw new Error('failed to fetch profile')
      return data
    }
  }
}

// Shared across every consumer via TanStack Query's own cache — no separate store needed.
export function useProfile() {
  return useQuery(userQueries.profile)
}
