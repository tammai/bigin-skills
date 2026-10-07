import type { components } from '@/shared/api-client/schema'
import type { SessionTokens } from './session'

// Server-only helpers for talking to the backend REST API directly (server →
// server, over the private BACKEND_URL). The browser NEVER calls these — it
// calls the same-origin BFF proxy at /api/backend/*. Auth routes
// (login/signup/logout) and the proxy's token-refresh step use these.

// Shapes follow the backend contract (openapi.json → schemas LoginResponse,
// TokenResponse, User), via the generated types — no hand-maintained copies.
type Schemas = components['schemas']
export type BackendTokenPair = Schemas['TokenResponse']
export type BackendUser = Schemas['User']

// The Go backend serves every route under this prefix (middleware.BaseURL).
// `backendUrl()` is just the origin; keep this and the client's baseUrl in
// src/shared/api-client/index.ts in step with it.
const API_PREFIX = '/api/v1'

// Thrown on any non-2xx backend response. `status` is the HTTP status. The
// backend's error body is `{ "error": "<message>" }` with no machine-readable
// code, so callers branch on `status`. The body is NEVER forwarded to the
// browser verbatim, so a backend leak can't reach an end user through the BFF.
export class BackendError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'BackendError'
  }
}

export function backendUrl(): string {
  const url = process.env.BACKEND_URL
  if (!url) throw new Error('BACKEND_URL is not configured')
  return url.replace(/\/+$/, '')
}

// The backend's refresh contract is reactive: the proxy forwards with the held
// access token and, on a 401, refreshes once and retries. TokenResponse carries
// no expiry, so nothing here tracks one.
export function toSessionTokens(pair: BackendTokenPair): SessionTokens {
  return { access_token: pair.access_token, refresh_token: pair.refresh_token }
}

// Deliberately does NOT read or surface the backend's own message: it can carry
// internal phrasing not meant for a browser. Callers branch on the status.
function toBackendError(res: Response, fallbackMessage: string): BackendError {
  return new BackendError(res.status, fallbackMessage)
}

// POST /auth/login answers with the token pair AND the user (LoginResponse), so
// the session can carry the real profile without decoding the JWT.
export async function backendLogin(email: string, password: string): Promise<{ tokens: SessionTokens, user: BackendUser }> {
  const res = await fetch(`${backendUrl()}${API_PREFIX}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store'
  })
  if (!res.ok) throw toBackendError(res, 'invalid email or password')
  const body = (await res.json()) as Schemas['LoginResponse']
  return { tokens: toSessionTokens(body), user: body.user }
}

export async function backendRefresh(refreshToken: string): Promise<SessionTokens> {
  const res = await fetch(`${backendUrl()}${API_PREFIX}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store'
  })
  if (!res.ok) throw toBackendError(res, 'session refresh failed')
  return toSessionTokens((await res.json()) as BackendTokenPair)
}

// Public sign-up (POST /auth/signup). Returns the created user; it does NOT
// log you in (no tokens), so callers follow it with backendLogin() to obtain a
// token pair.
export async function backendSignup(fullName: string, email: string, password: string): Promise<BackendUser> {
  const res = await fetch(`${backendUrl()}${API_PREFIX}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ full_name: fullName, email, password }),
    cache: 'no-store'
  })
  if (!res.ok) throw toBackendError(res, 'could not create account')
  return (await res.json()) as BackendUser
}

// Best-effort backend logout. Intentionally does not throw or return a result —
// see api/logout/route.ts for why local logout must always succeed even if the
// backend call fails or times out. The Go route needs only the refresh token in
// the body; no Authorization header is required.
export async function backendLogout(refreshToken: string): Promise<void> {
  try {
    await fetch(`${backendUrl()}${API_PREFIX}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store'
    })
  } catch {
    // swallow — local session teardown proceeds regardless
  }
}
