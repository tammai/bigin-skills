import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './index'

describe('apiClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('calls the same-origin /api/v1 pass-through with credentials included', async () => {
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(async () => Response.json({ id: 1, email: 'a@example.com', role: 'user' }))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.GET('/user/profile')

    const request = fetchMock.mock.calls[0][0]
    expect(new URL(request.url).pathname).toBe('/api/v1/user/profile')
    // The API's HttpOnly session cookie only rides along when credentials are included.
    expect(request.credentials).toBe('include')
    expect(request.headers.get('authorization')).toBeNull()
  })
})
