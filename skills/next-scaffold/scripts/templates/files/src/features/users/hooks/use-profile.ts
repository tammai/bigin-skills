import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/shared/api-client'
import { ApiError, isApiError } from '@/shared/api-client/errors'
import type { components } from '@/shared/api-client/schema'

// User shape comes straight from the generated contract (schemas.User) — no
// hand-maintained duplicate. Regenerate the contract types with
// `pnpm openapi:generate` when the API changes.
export type User = components['schemas']['User']

export const userQueries = {
  profile: {
    queryKey: ['users', 'profile'] as const,
    queryFn: async (): Promise<User> => {
      // Same-origin through the /api/v1 pass-through; the API's session cookie rides along
      // (credentials: 'include'). A 401 is an ApiError(401): "no session", not a failure.
      const { data, response } = await apiClient.GET('/user/profile')
      if (!data) throw new ApiError(response.status)
      return data
    },
    // Retrying a 4xx cannot help and would delay the redirect to /login by seconds.
    retry: (failureCount: number, error: unknown) => !(isApiError(error) && error.status < 500) && failureCount < 2
  }
}

// Shared across every consumer via TanStack Query's own cache — no separate store needed.
export function useProfile() {
  return useQuery(userQueries.profile)
}
