import { afterEach, describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProfile } from './use-profile'
import { isApiError } from '@/shared/api-client/errors'

function wrapperFor(queryClient: QueryClient) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return wrapper
}

describe('useProfile', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('starts fetching immediately through the openapi-fetch client', () => {
    // The hook calls the generated client, which calls fetch under the hood —
    // stub it so the query stays in flight while we assert the initial status.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { result } = renderHook(() => useProfile(), { wrapper: wrapperFor(new QueryClient()) })
    // TanStack Query has no 'idle' status — useQuery fires eagerly, so a fresh query is 'pending'.
    expect(result.current.status).toBe('pending')
  })

  it('surfaces a 401 as an ApiError(401) without retrying', async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: 'unauthorized' }, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useProfile(), { wrapper: wrapperFor(new QueryClient()) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(isApiError(result.current.error, 401)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
