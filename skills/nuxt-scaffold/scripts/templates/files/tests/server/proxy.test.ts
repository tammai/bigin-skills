import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { proxyToBackend, isCrossSiteMutation, type ProxySession } from '~~/server/utils/proxy'
import type { SessionTokens } from '~~/shared/types/session'

// The proxy core is h3-free: it takes an explicit `base`, request parts, and a
// ProxySession, and uses the global fetch (stubbed here). This mirrors Phase 2's
// Next proxy test — it exercises the same forwarding + refresh-retry + CSRF logic
// without spinning up a Nitro server.

const BACKEND = 'http://backend.test'

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function errorBody(code: string) {
  return { error: { code, message: 'nope', request_id: 'req-1' } }
}

function tokenPair(access: string, refresh: string) {
  return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: 900 }
}

let session: ProxySession & { save: ReturnType<typeof vi.fn>, clear: ReturnType<typeof vi.fn> }

beforeEach(() => {
  const tokens: SessionTokens = { access_token: 'access-1', refresh_token: 'refresh-1', expires_at: Date.now() + 900_000 }
  session = {
    tokens,
    save: vi.fn(async (t: SessionTokens) => { session.tokens = t }),
    reload: vi.fn(async () => session.tokens),
    clear: vi.fn(async () => { session.tokens = undefined })
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function call(method = 'GET', path = '/v1/users', search = '') {
  return proxyToBackend({ base: BACKEND, method, path, search, headers: new Headers(), body: undefined, session })
}

describe('backend proxy — auth forwarding', () => {
  it('attaches the session access token as a Bearer header and forwards to the backend verbatim', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(200, { data: [], limit: 20, offset: 0 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await call('GET', '/v1/users', '?limit=20')

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    // version-agnostic passthrough: /v1 stays in the path (no trailing slash — Go/chi serves it verbatim)
    expect(url).toBe('http://backend.test/v1/users?limit=20')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer access-1')
  })
})

describe('backend proxy — 401 → refresh → retry (ADR §7.3)', () => {
  it('on a 401, refreshes once, retries once with the new token, and persists the new pair', async () => {
    let forwardCalls = 0
    let refreshCalls = 0
    const fetchMock = vi.fn<FetchFn>().mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/auth/refresh')) {
        refreshCalls++
        return jsonResponse(200, tokenPair('access-2', 'refresh-2'))
      }
      forwardCalls++
      return forwardCalls === 1
        ? jsonResponse(401, errorBody('unauthenticated'))
        : jsonResponse(200, { data: [], limit: 20, offset: 0 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await call('GET', '/v1/users')

    expect(res.status).toBe(200)
    expect(refreshCalls).toBe(1) // exactly one refresh
    expect(forwardCalls).toBe(2) // original + one retry, never more
    // retry used the refreshed token
    const retryInit = fetchMock.mock.calls[2][1]
    expect(new Headers(retryInit?.headers).get('authorization')).toBe('Bearer access-2')
    // new pair saved back into the session
    expect(session.save).toHaveBeenCalledTimes(1)
    expect(session.tokens?.access_token).toBe('access-2')
  })

  it('when refresh also fails, clears the session and returns 401 to the caller (no second retry)', async () => {
    let forwardCalls = 0
    let refreshCalls = 0
    const fetchMock = vi.fn<FetchFn>().mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/auth/refresh')) {
        refreshCalls++
        return jsonResponse(401, errorBody('users.invalid_refresh_token')) // refresh rejected
      }
      forwardCalls++
      return jsonResponse(401, errorBody('unauthenticated'))
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await call('GET', '/v1/users')

    expect(res.status).toBe(401)
    expect(refreshCalls).toBe(1)
    expect(forwardCalls).toBe(1) // original only — no retry after a failed refresh
    expect(session.clear).toHaveBeenCalledTimes(1)
    expect(session.tokens).toBeUndefined()
    expect(res.body).not.toBeNull()
    const body = JSON.parse(new TextDecoder().decode(res.body ?? new ArrayBuffer(0))) as { error: { code: string } }
    expect(body.error.code).toBe('unauthenticated')
  })

  it('when a sibling request already rotated the token, retries with the new token instead of clearing the session', async () => {
    // Concurrent-401 race: this request reads refresh-1, but by the time its own
    // refresh is rejected (a sibling already rotated the family, reuse-detected),
    // the session holds a freshly-rotated pair. The proxy must re-read the session
    // (reload), notice the refresh token changed, and retry with the new access
    // token — NOT sign the user out over a lost race.
    const rotated: SessionTokens = { access_token: 'access-2', refresh_token: 'refresh-2', expires_at: Date.now() + 900_000 }
    session.reload = vi.fn(async () => rotated)

    let forwardCalls = 0
    const fetchMock = vi.fn<FetchFn>().mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/auth/refresh')) {
        return jsonResponse(401, errorBody('users.invalid_refresh_token')) // our own refresh loses the race
      }
      forwardCalls++
      return forwardCalls === 1
        ? jsonResponse(401, errorBody('unauthenticated'))
        : jsonResponse(200, { data: [], limit: 20, offset: 0 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await call('GET', '/v1/users')

    expect(res.status).toBe(200)
    expect(forwardCalls).toBe(2) // original + one retry with the sibling's token
    expect(session.clear).not.toHaveBeenCalled() // session NOT torn down over a lost race
    // the retry used the token the sibling rotated in, not the stale one
    const retryInit = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1]
    expect(new Headers(retryInit?.headers).get('authorization')).toBe('Bearer access-2')
  })
})

describe('backend proxy — CSRF gate (isCrossSiteMutation)', () => {
  it('rejects a cross-site mutation', () => {
    expect(isCrossSiteMutation('POST', 'cross-site', undefined, 'localhost:3000')).toBe(true)
  })
  it('allows a same-origin mutation', () => {
    expect(isCrossSiteMutation('POST', 'same-origin', undefined, 'localhost:3000')).toBe(false)
  })
  it('allows a direct navigation / no-referrer request (sec-fetch-site: none)', () => {
    expect(isCrossSiteMutation('POST', 'none', undefined, 'localhost:3000')).toBe(false)
  })
  it('never gates safe methods', () => {
    expect(isCrossSiteMutation('GET', 'cross-site', undefined, 'localhost:3000')).toBe(false)
  })
  it('falls back to an Origin-host comparison when Sec-Fetch-Site is absent', () => {
    expect(isCrossSiteMutation('DELETE', undefined, 'http://evil.test', 'localhost:3000')).toBe(true)
    expect(isCrossSiteMutation('DELETE', undefined, 'http://localhost:3000', 'localhost:3000')).toBe(false)
    expect(isCrossSiteMutation('DELETE', undefined, undefined, 'localhost:3000')).toBe(true) // missing Origin is suspicious
  })
})

// The pure helper (isCrossSiteMutation) is covered above; this exercises the H3
// middleware wrapper itself — the /api/ path gate and the createError({403}) throw.
// H3 server utilities (getRequestURL/getHeader/createError) are auto-imports in a
// real Nitro build; here we stub them as globals so the handler runs standalone.
describe('CSRF middleware handler (server/middleware/csrf.ts)', () => {
  let handler: (event: unknown) => void

  beforeAll(async () => {
    vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
    handler = (await import('~~/server/middleware/csrf')).default as typeof handler
    vi.unstubAllGlobals()
  })

  // Invoke the middleware with stubbed request accessors; return the thrown error (if any).
  function run(opts: { method: string, path: string, secFetchSite?: string, origin?: string, host?: string }) {
    const host = opts.host ?? 'localhost:3000'
    vi.stubGlobal('getRequestURL', () => new URL(`http://${host}${opts.path}`))
    vi.stubGlobal('getHeader', (_e: unknown, name: string) =>
      name === 'sec-fetch-site' ? opts.secFetchSite : name === 'origin' ? opts.origin : undefined)
    vi.stubGlobal('createError', (o: { statusCode: number, statusMessage: string }) => {
      const err = new Error(o.statusMessage) as Error & { statusCode: number }
      err.statusCode = o.statusCode
      return err
    })
    let thrown: (Error & { statusCode?: number }) | undefined
    try {
      handler({ method: opts.method })
    } catch (e) {
      thrown = e as Error & { statusCode?: number }
    }
    return thrown
  }

  it('rejects a cross-site mutation to the /api/backend proxy with a 403', () => {
    const err = run({ method: 'POST', path: '/api/backend/v1/users', secFetchSite: 'cross-site' })
    expect(err?.statusCode).toBe(403)
  })

  it('rejects a cross-site mutation to the /api/login auth route with a 403 (broadened gate — login CSRF)', () => {
    const err = run({ method: 'POST', path: '/api/login', secFetchSite: 'cross-site' })
    expect(err?.statusCode).toBe(403)
  })

  it('also rejects the login CSRF via the Origin-host fallback when Sec-Fetch-Site is absent', () => {
    const err = run({ method: 'POST', path: '/api/login', origin: 'http://evil.test' })
    expect(err?.statusCode).toBe(403)
  })

  it('allows a same-origin mutation to an auth route', () => {
    expect(run({ method: 'POST', path: '/api/login', secFetchSite: 'same-origin' })).toBeUndefined()
  })

  it('allows a safe GET regardless of origin', () => {
    expect(run({ method: 'GET', path: '/api/backend/v1/users', secFetchSite: 'cross-site' })).toBeUndefined()
  })

  it('ignores non-/api routes entirely (no gate)', () => {
    expect(run({ method: 'POST', path: '/login', secFetchSite: 'cross-site' })).toBeUndefined()
  })
})
