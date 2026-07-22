// Server-only helpers for talking to the Go backend REST API directly (server →
// server, over the private NUXT_BACKEND_URL). The browser NEVER calls these — it
// calls the same-origin BFF proxy at /api/backend/*. Auth routes
// (login/signup/logout) and the proxy's token-refresh step use these.
//
// Deliberately h3-free (no defineEventHandler/useRuntimeConfig imports): every
// function takes an already-resolved `base` URL and uses the global `fetch`, so
// it is unit-testable by stubbing global fetch — no Nuxt/Nitro runtime needed.

// SessionTokens is shared-owned (also referenced by the #auth-utils augmentation
// in shared/types/session.d.ts). Imported for use here; NOT re-exported — a
// re-export would register a second Nuxt auto-import source for the same name and
// trip a "Duplicated imports" warning. Consumers import it from shared/types too.
import type { SessionTokens } from '~~/shared/types/session'

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

// Thrown on any non-2xx backend response. `status` is the HTTP status; `code` is
// the backend's error-envelope code (e.g. 'users.email_taken') when present.
// Callers map this to a clean client-facing response — the raw backend body
// (request_id, internal details) is NEVER forwarded to the browser verbatim, so
// a backend leak can't reach an end user through the BFF.
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

// Validates + normalises the configured backend URL (NUXT_BACKEND_URL, read via
// runtimeConfig.backendUrl by callers). Trailing slashes are stripped so the
// proxy can append the incoming path (e.g. /v1/users) without doubling up.
export function resolveBackendUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('NUXT_BACKEND_URL is not configured')
  }
  return raw.replace(/\/+$/, '')
}

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

// POST /v1/auth/login → 200 TokenPair | 401. The Go/chi backend serves paths
// exactly as written in api/openapi.yaml (no trailing-slash redirect), so paths
// here carry no trailing slash.
export async function backendLogin(base: string, email: string, password: string): Promise<SessionTokens> {
  const res = await fetch(`${base}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store'
  })
  if (!res.ok) throw await toBackendError(res, 'invalid email or password')
  return toSessionTokens((await res.json()) as BackendTokenPair)
}

// POST /v1/auth/refresh → rotates the refresh token for a new pair. 401 on an
// invalid or already-used (reuse-detected) token.
export async function backendRefresh(base: string, refreshToken: string): Promise<SessionTokens> {
  const res = await fetch(`${base}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store'
  })
  if (!res.ok) throw await toBackendError(res, 'session refresh failed')
  return toSessionTokens((await res.json()) as BackendTokenPair)
}

// Public sign-up: POST /v1/users → 201 User, 409 users.email_taken, 422
// validation_failed. NOTE: the Go backend has NO idempotency-key middleware, so
// (unlike the Fastify pairing) we send no Idempotency-Key header. It creates the
// account but does NOT log you in (no tokens) — callers follow it with
// backendLogin() to obtain a token pair.
export async function backendSignup(base: string, name: string, email: string, password: string): Promise<BackendUser> {
  const res = await fetch(`${base}/v1/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, name, password }),
    cache: 'no-store'
  })
  if (!res.ok) throw await toBackendError(res, 'could not create account')
  return (await res.json()) as BackendUser
}

// Best-effort backend logout (POST /v1/auth/logout, bearer + refresh token).
// Intentionally does not throw — see api/logout.post.ts for why local logout
// must always succeed even if the backend call fails or times out.
export async function backendLogout(base: string, accessToken: string, refreshToken: string): Promise<void> {
  try {
    await fetch(`${base}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store'
    })
  } catch {
    // swallow — local session teardown proceeds regardless
  }
}
