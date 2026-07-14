import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUsers } from './use-users'

describe('useUsers', () => {
  it('starts fetching immediately', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useUsers(), { wrapper })
    // TanStack Query has no 'idle' status — useQuery fires eagerly, so a fresh query is 'pending'.
    expect(result.current.status).toBe('pending')
    vi.unstubAllGlobals()
  })
})
