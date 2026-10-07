import { apiClient } from '~~/shared/api-client'
import type { AuthUser } from '~~/shared/types/auth'

// Browser sessions against go-scaffold's cookie-session endpoints, reached through the
// /api pass-through (apiClient's baseURL is '/api', so '/v1/…' is /api/v1/…). The API sets
// and clears the HttpOnly session cookie itself; this code never sees a token. Mutations must
// come from an origin listed in the API's WEB_ORIGINS, or the API answers 403.
export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)

  // POST /api/v1/auth/session — 201 { user } + Set-Cookie, 401 on bad credentials.
  async function login(email: string, password: string) {
    const session = await apiClient<{ user: AuthUser }>('/v1/auth/session', { method: 'POST', body: { email, password } })
    user.value = session.user
  }

  // POST /api/v1/auth/signup — 201 User, 409 when the email is taken. It does not sign you
  // in, so sign-up is followed by login().
  async function signup(fullName: string, email: string, password: string) {
    await apiClient('/v1/auth/signup', { method: 'POST', body: { email, password, full_name: fullName } })
    await login(email, password)
  }

  // DELETE /api/v1/auth/session — drops the session server-side and clears the cookie.
  async function logout() {
    try {
      await apiClient('/v1/auth/session', { method: 'DELETE' })
    } finally {
      user.value = null
    }
  }

  // GET /api/v1/user/profile — the current user, or null on a 401 (no session, or it expired).
  // Any other failure (API down, 5xx) throws rather than pretending the visitor signed out.
  async function fetchUser() {
    try {
      user.value = await apiClient<AuthUser>('/v1/user/profile')
    } catch (error) {
      if ((error as { status?: number }).status !== 401) throw error
      user.value = null
    }
    return user.value
  }

  return { user, login, signup, logout, fetchUser }
}
