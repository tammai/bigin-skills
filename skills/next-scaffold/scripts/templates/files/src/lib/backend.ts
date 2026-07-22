import type { SessionTokens } from './session'

// Server-only helpers for talking to the backend REST API directly (server →
// server, over the private BACKEND_URL). The browser NEVER calls these — it
// calls the same-origin BFF proxy at /api/backend/*. Auth routes
// (login/signup/logout) and the proxy's token-refresh step use these.

export type BackendTokenPair = {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export type BackendUser = {
  id: string
  email: string
  name: string
  created_at: string
}

// Thrown on any non-2xx backend response. `status` is the HTTP status; `code`
// is the backend's error-envelope code (e.g. 'users.email_taken') when present.
// Callers map this to a clean client-facing response — the raw backend body
// (request_id, internal details, stack-ish messages) is NEVER forwarded to the
// browser verbatim, so a backend leak can't reach an end user through the BFF.
export class BackendError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
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

// Absolute epoch-ms deadline computed at write time from the backend's
// `expires_in`, so the proxy can check access-token staleness without decoding
// or verifying the JWT on every forwarded request.
export function toSessionTokens(pair: BackendTokenPair): SessionTokens {
  return {
    access_token: pair.access_token,
    refresh_token: pair.refresh_token,
    expires_at: Date.now() + pair.expires_in * 1000
  }
}

async function toBackendError(res: Response, fallbackMessage: string): Promise<BackendError> {
  let code = 'backend_error'
  try {
    const body = (await res.json()) as { error?: { code?: string } }
    if (body?.error?.code) code = body.error.code
  } catch {
    // non-JSON body — keep the generic code
  }
  // Deliberately does NOT surface the backend's own message: it can carry a
  // request_id and internal phrasing not meant for a browser.
  return new BackendError(res.status, code, fallbackMessage)
}

export async function backendLogin(email: string, password: string): Promise<SessionTokens> {
  const res = await fetch(`${backendUrl()}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store'
  })
  if (!res.ok) throw await toBackendError(res, 'invalid email or password')
  return toSessionTokens((await res.json()) as BackendTokenPair)
}

export async function backendRefresh(refreshToken: string): Promise<SessionTokens> {
  const res = await fetch(`${backendUrl()}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store'
  })
  if (!res.ok) throw await toBackendError(res, 'session refresh failed')
  return toSessionTokens((await res.json()) as BackendTokenPair)
}

// Public sign-up (POST /v1/users/ — the collection path carries a trailing
// slash: Fastify combines the module prefix with the '/' route). Returns the
// created user; it does NOT log you in (no tokens), so callers follow it with
// backendLogin() to obtain a token pair.
export async function backendSignup(name: string, email: string, password: string): Promise<BackendUser> {
  const res = await fetch(`${backendUrl()}/v1/users/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // POST /v1/users is an idempotent route — the backend requires an
      // Idempotency-Key and rejects the request without one. A fresh UUID per
      // sign-up attempt is the right grain: a network-level retry of this exact
      // fetch would reuse it (dedup), while a genuinely new attempt gets a new key.
      'idempotency-key': crypto.randomUUID()
    },
    body: JSON.stringify({ name, email, password }),
    cache: 'no-store'
  })
  if (!res.ok) throw await toBackendError(res, 'could not create account')
  return (await res.json()) as BackendUser
}

// Best-effort backend logout. Intentionally does not throw or return a result —
// see api/logout/route.ts for why local logout must always succeed even if the
// backend call fails or times out.
export async function backendLogout(accessToken: string, refreshToken: string): Promise<void> {
  try {
    await fetch(`${backendUrl()}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store'
    })
  } catch {
    // swallow — local session teardown proceeds regardless
  }
}
