import { useQuery } from '@tanstack/react-query'

export type User = { id: string, name: string }

export const userQueries = {
  list: {
    queryKey: ['users', 'list'] as const,
    queryFn: async (): Promise<User[]> => {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('failed to fetch users')
      return res.json()
    }
  }
}

// Shared across every consumer via TanStack Query's own cache — no separate store needed.
export function useUsers() {
  return useQuery(userQueries.list)
}
