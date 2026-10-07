import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '~~/shared/api-client'
import { useAuth } from '~~/app/composables/useAuth'

// The pages call the API's cookie-session endpoints only through useAuth(), so this pins the
// exact method, path and body of each call (the API's BaseURL is /api/v1 and the client's
// baseURL is /api, so '/v1/…' is /api/v1/…). apiClient is mocked: no network, no cookie.
vi.mock('~~/shared/api-client', () => ({ apiClient: vi.fn() }))

const client = vi.mocked(apiClient) as unknown as ReturnType<typeof vi.fn>
const alice = { id: 7, email: 'alice@example.com', full_name: 'Alice', role: 'user' }

beforeEach(() => {
  client.mockReset()
  useAuth().user.value = null
})

describe('useAuth', () => {
  it('login POSTs the credentials to /v1/auth/session and keeps the returned user', async () => {
    client.mockResolvedValue({ user: alice })
    const { login, user } = useAuth()

    await login('alice@example.com', 'password123')

    expect(client).toHaveBeenCalledWith('/v1/auth/session', { method: 'POST', body: { email: 'alice@example.com', password: 'password123' } })
    expect(user.value).toEqual(alice)
  })

  it('signup POSTs to /v1/auth/signup with full_name, then signs in', async () => {
    client.mockResolvedValueOnce(alice).mockResolvedValueOnce({ user: alice })
    const { signup, user } = useAuth()

    await signup('Alice', 'alice@example.com', 'password123')

    expect(client).toHaveBeenNthCalledWith(1, '/v1/auth/signup', { method: 'POST', body: { email: 'alice@example.com', password: 'password123', full_name: 'Alice' } })
    expect(client).toHaveBeenNthCalledWith(2, '/v1/auth/session', { method: 'POST', body: { email: 'alice@example.com', password: 'password123' } })
    expect(user.value).toEqual(alice)
  })

  it('signup does not try to sign in when the account was not created', async () => {
    client.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }))

    await expect(useAuth().signup('Alice', 'alice@example.com', 'password123')).rejects.toThrow('conflict')
    expect(client).toHaveBeenCalledTimes(1)
  })

  it('logout DELETEs /v1/auth/session and forgets the user, even when the call fails', async () => {
    const { logout, user } = useAuth()
    user.value = alice
    client.mockRejectedValue(new Error('network'))

    await expect(logout()).rejects.toThrow('network')

    expect(client).toHaveBeenCalledWith('/v1/auth/session', { method: 'DELETE' })
    expect(user.value).toBeNull()
  })

  it('fetchUser GETs /v1/user/profile and keeps the user', async () => {
    client.mockResolvedValue(alice)
    const { fetchUser, user } = useAuth()

    expect(await fetchUser()).toEqual(alice)
    expect(client).toHaveBeenCalledWith('/v1/user/profile')
    expect(user.value).toEqual(alice)
  })

  it('fetchUser answers null and clears the user on a 401', async () => {
    const { fetchUser, user } = useAuth()
    user.value = alice
    client.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }))

    expect(await fetchUser()).toBeNull()
    expect(user.value).toBeNull()
  })

  it('fetchUser rethrows anything that is not a 401', async () => {
    client.mockRejectedValue(Object.assign(new Error('bad gateway'), { status: 502 }))

    await expect(useAuth().fetchUser()).rejects.toThrow('bad gateway')
  })
})
