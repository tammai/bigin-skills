import { describe, it, expect, vi } from 'vitest'
import { authRedirect } from '~~/app/utils/auth-redirect'

// /dashboard asks the API for the current user (fetchUser is useAuth()'s GET /api/v1/user/profile)
// and goes to /login when there is none, which is what a 401 from the API produces.
describe('authRedirect', () => {
  it('sends /dashboard to /login when the API has no user for the cookie', async () => {
    const fetchUser = vi.fn().mockResolvedValue(null)

    expect(await authRedirect('/dashboard', null, fetchUser)).toBe('/login')
    expect(fetchUser).toHaveBeenCalledTimes(1)
  })

  it('lets a signed-in visitor into /dashboard and its sub-routes', async () => {
    const fetchUser = vi.fn().mockResolvedValue({ id: 1 })

    expect(await authRedirect('/dashboard', null, fetchUser)).toBeNull()
    expect(await authRedirect('/dashboard/settings', null, fetchUser)).toBeNull()
  })

  it('does not hide an API failure behind a redirect', async () => {
    const fetchUser = vi.fn().mockRejectedValue(new Error('bad gateway'))

    await expect(authRedirect('/dashboard', null, fetchUser)).rejects.toThrow('bad gateway')
  })

  it('sends a known signed-in user away from /login and /signup', async () => {
    const fetchUser = vi.fn()

    expect(await authRedirect('/login', { id: 1 }, fetchUser)).toBe('/dashboard')
    expect(await authRedirect('/signup', { id: 1 }, fetchUser)).toBe('/dashboard')
    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('leaves public pages alone without calling the API', async () => {
    const fetchUser = vi.fn()

    expect(await authRedirect('/', null, fetchUser)).toBeNull()
    expect(await authRedirect('/pricing', { id: 1 }, fetchUser)).toBeNull()
    expect(await authRedirect('/login', null, fetchUser)).toBeNull()
    expect(fetchUser).not.toHaveBeenCalled()
  })
})
