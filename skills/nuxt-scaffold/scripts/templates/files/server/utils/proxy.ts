import { backendRefresh } from './backend'
import type { SessionTokens } from '~~/shared/types/session'

// ── BFF backend proxy core ────────────────────────────────────────────────
// Pure, h3-free logic behind server/api/backend/[...path].ts and the CSRF
// middleware, so both are unit-testable by stubbing global fetch and passing a
// fake session. The event-handler wrapper does the H3 plumbing (reading the
// nuxt-auth-utils session, the request body, and writing the response).

// Exported so the proxy handler (server/api/backend/[...path].ts) reuses this one
// definition instead of redeclaring it.
export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const BFF_PREFIX = '/api/backend'

// Every server route this app defines lives under /api/. The CSRF middleware
// gates mutations to ALL of them (not just the /api/backend proxy) so a future
// auth-adjacent route can't reintroduce a login-CSRF gap (ADR §7).
export const API_PREFIX = '/api/'

// Same-origin gate for state-changing requests (CSRF defense, ADR §7). A
// cookie-authenticated API is vulnerable to CSRF unless it verifies the request
// came from its own site. Modern browsers send Sec-Fetch-Site on every request;
// fall back to an Origin-host comparison for the rare client that doesn't.
// Returns true when the request should be REJECTED.
export function isCrossSiteMutation(method: string, secFetchSite: string | undefined, origin: string | undefined, host: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false
  if (secFetchSite) return !(secFetchSite === 'same-origin' || secFetchSite === 'none')
  if (!origin) return true // a browser mutation always sends Origin; absence is suspicious
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

// The session surface the proxy needs. Backed by nuxt-auth-utils in the handler
// (getUserSession/setUserSession/clearUserSession); a plain object in tests.
// `reload` re-reads the session's *current* tokens so the refresh path can tell a
// genuinely dead session apart from one a concurrent request just rotated.
export type ProxySession = {
  tokens: SessionTokens | undefined
  save: (tokens: SessionTokens) => Promise<void>
  reload: () => Promise<SessionTokens | undefined>
  clear: () => Promise<void>
}

export type ProxyResult = {
  status: number
  contentType: string | null
  body: ArrayBuffer | null
}

function errorBody(code: string, message: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify({ error: { code, message } }))
  // Return a standalone ArrayBuffer (not the view's underlying buffer, which may
  // be a larger pool) so the caller sends exactly these bytes.
  return bytes.slice().buffer
}

async function forward(target: string, method: string, headers: Headers, body: ArrayBuffer | undefined, accessToken: string | undefined): Promise<Response> {
  const outHeaders = new Headers(headers)
  outHeaders.delete('host')
  outHeaders.delete('cookie') // never leak the sealed session cookie to the backend
  outHeaders.delete('content-length') // recomputed by fetch
  if (accessToken) outHeaders.set('authorization', `Bearer ${accessToken}`)
  else outHeaders.delete('authorization')
  return fetch(target, { method, headers: outHeaders, body, redirect: 'manual', cache: 'no-store' })
}

// Forwards to `${base}${path}${search}` verbatim (version-agnostic passthrough —
// the /v1 lives in the path, so a future /v2/* needs no change here), attaching
// the session's access token as Bearer. On a 401 with a refresh token in hand,
// refreshes once, persists the new pair, and retries exactly once (ADR §7.3);
// if refresh also fails, re-reads the session to rule out a lost concurrent-
// refresh race before clearing the session and returning 401.
export async function proxyToBackend(opts: {
  base: string
  method: string
  path: string
  search: string
  headers: Headers
  body: ArrayBuffer | undefined
  session: ProxySession
}): Promise<ProxyResult> {
  const target = `${opts.base}${opts.path}${opts.search}`
  let res = await forward(target, opts.method, opts.headers, opts.body, opts.session.tokens?.access_token)

  if (res.status === 401 && opts.session.tokens?.refresh_token) {
    const attemptedRefreshToken = opts.session.tokens.refresh_token
    try {
      const refreshed = await backendRefresh(opts.base, attemptedRefreshToken)
      await opts.session.save(refreshed)
      res = await forward(target, opts.method, opts.headers, opts.body, refreshed.access_token)
    } catch {
      // Refresh failed — but before signing the user out, rule out a lost race.
      // Two requests sharing one session can both hit a 401 and both read the
      // same refresh_token; only one wins the rotate, and a backend with
      // reuse-detection revokes the token family when the loser replays the now
      // stale token. Re-read the session: if the refresh_token has since changed,
      // a sibling already rotated it successfully, so retry the original forward
      // with the current access token instead of destroying a still-valid session.
      const fresh = await opts.session.reload()
      if (fresh?.refresh_token && fresh.refresh_token !== attemptedRefreshToken) {
        res = await forward(target, opts.method, opts.headers, opts.body, fresh.access_token)
      } else {
        // Genuinely the same stale token — the refresh really did fail (expired /
        // reuse-detected). Clear the session so the next request re-authenticates,
        // and tell the client it's unauthenticated.
        await opts.session.clear()
        return { status: 401, contentType: 'application/json', body: errorBody('unauthenticated', 'session expired, please sign in again') }
      }
    }
  }

  const buf = res.status === 204 ? null : await res.arrayBuffer()
  return { status: res.status, contentType: res.headers.get('content-type'), body: buf }
}
