import {
  backendLogin,
  backendSignup,
  backendLogout,
  BackendError,
  type BackendUser
} from './backend'
import type { SessionTokens } from '~~/shared/types/session'

// The session writes each auth flow performs. Backed by nuxt-auth-utils in the
// handlers (setUserSession/clearUserSession); a fake in tests. Keeping the flows
// h3-free makes them unit-testable by stubbing global fetch.
export type SessionWriter = {
  setUser: (user: { id?: string, email: string, name?: string }, tokens: SessionTokens) => Promise<void>
  clear: () => Promise<void>
}

// POST /v1/auth/login → store the token pair (server-only) + the email for
// display. The login response carries no user object, and we deliberately do NOT
// decode the JWT just to recover one — the token pair is all the proxy needs.
export async function performLogin(base: string, email: string, password: string, write: SessionWriter): Promise<{ email: string }> {
  const tokens = await backendLogin(base, email, password)
  await write.setUser({ email }, tokens)
  return { email }
}

// POST /v1/users creates the account but does NOT log you in (no tokens) — follow
// it with a login call, reusing the same credentials, to obtain the token pair
// before writing the session. A BackendError from either call aborts before any
// session write.
export async function performSignup(base: string, name: string, email: string, password: string, write: SessionWriter): Promise<BackendUser> {
  const user = await backendSignup(base, name, email, password)
  const tokens = await backendLogin(base, email, password)
  await write.setUser({ id: user.id, email: user.email, name: user.name }, tokens)
  return user
}

// Best-effort backend revocation, then always tear down the local session.
// Logout must succeed client-side even if the backend is slow or down (see
// api/logout.post.ts) — backendLogout swallows its own errors.
export async function performLogout(base: string, tokens: SessionTokens | undefined, write: SessionWriter): Promise<void> {
  if (tokens) await backendLogout(base, tokens.access_token, tokens.refresh_token)
  await write.clear()
}

export type RouteResponse = { status: number, body: { error: { code: string, message: string } } }

// Maps a rejected performLogin() into the clean client response. Login
// collapses every backend failure into the same generic client code — 401 for
// actual bad credentials, 502 for anything else the backend couldn't serve —
// so a failed login never distinguishes "wrong password" from "backend
// degraded" to the caller. Kept h3-free (pure in, pure out) so the status/code
// mapping is directly unit-testable without stubbing any Nitro auto-import.
export function loginErrorResponse(err: unknown): RouteResponse {
  if (err instanceof BackendError) {
    return {
      status: err.status === 401 ? 401 : 502,
      body: { error: { code: 'unauthenticated', message: 'Invalid email or password' } }
    }
  }
  return { status: 502, body: { error: { code: 'internal_error', message: 'Login failed, try again' } } }
}

// Maps a rejected performSignup() into the clean client response: 409/422 get
// their specific codes, other 4xx pass through the backend's own error code,
// and everything else (5xx, non-BackendError) becomes a generic 502.
export function signupErrorResponse(err: unknown): RouteResponse {
  if (err instanceof BackendError) {
    if (err.status === 409) {
      return { status: 409, body: { error: { code: 'users.email_taken', message: 'That email is already registered' } } }
    }
    if (err.status === 422) {
      return { status: 422, body: { error: { code: 'validation_failed', message: 'Invalid sign-up details' } } }
    }
    return {
      status: err.status >= 400 && err.status < 500 ? err.status : 502,
      body: { error: { code: err.code, message: 'Sign up failed' } }
    }
  }
  return { status: 502, body: { error: { code: 'internal_error', message: 'Sign up failed, try again' } } }
}
