// Where the global auth middleware should send a visitor, or null to let the navigation through.
// Pure — the caller passes what it knows and a way to ask the API — so it needs no Nuxt runtime.
// The session is an HttpOnly cookie the browser can't inspect, so "signed in" is whatever the API says:
// /dashboard asks for the current user (GET /api/v1/user/profile, via useAuth().fetchUser) and a
// missing one means /login.
export async function authRedirect(
  path: string,
  knownUser: unknown,
  fetchUser: () => Promise<unknown>
): Promise<string | null> {
  if (path.startsWith('/dashboard')) return await fetchUser() ? null : '/login'
  if ((path === '/login' || path === '/signup') && knownUser) return '/dashboard'
  return null
}
