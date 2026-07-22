import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import type { SessionTokens } from '@/lib/session'
import { GET, POST } from './route'

// The proxy reads the session via getSession() — mock it so the test controls
// the token pair and can observe save()/destroy(). The real backend calls
// (forward + token refresh) both go through global.fetch, which we stub.
let mockSession: { tokens?: SessionTokens, save: ReturnType<typeof vi.fn>, destroy: ReturnType<typeof vi.fn> }

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => mockSession)
}))

const BACKEND = 'http://backend.test'

// Typed fetch mock signature so `.mock.calls` are tuples we can index without
// casts, and without declaring unused params.
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

beforeEach(() => {
  process.env.BACKEND_URL = BACKEND
  mockSession = {
    tokens: { access_token: 'access-1', refresh_token: 'refresh-1', expires_at: Date.now() + 900_000 },
    save: vi.fn(async () => {}),
    destroy: vi.fn(() => {
      mockSession.tokens = undefined
    })
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('backend proxy — auth forwarding', () => {
  it('attaches the session access token as a Bearer header and forwards to BACKEND_URL', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(200, { data: [], next_cursor: null }))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/users/', {
      method: 'GET',
      headers: { 'sec-fetch-site': 'same-origin' }
    })
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    // version-agnostic passthrough: path (incl. trailing slash) preserved verbatim
    expect(url).toBe('http://backend.test/v1/users/')
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
        : jsonResponse(200, { data: [], next_cursor: null })
    })
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/users/', {
      method: 'GET',
      headers: { 'sec-fetch-site': 'same-origin' }
    })
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(refreshCalls).toBe(1) // exactly one refresh
    expect(forwardCalls).toBe(2) // original + one retry, never more
    // retry used the refreshed token
    const retryInit = fetchMock.mock.calls[2][1]
    expect(new Headers(retryInit?.headers).get('authorization')).toBe('Bearer access-2')
    // new pair saved back into the session
    expect(mockSession.save).toHaveBeenCalledTimes(1)
    expect(mockSession.tokens?.access_token).toBe('access-2')
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

    const req = new NextRequest('http://localhost:3000/api/backend/v1/users/', {
      method: 'GET',
      headers: { 'sec-fetch-site': 'same-origin' }
    })
    const res = await GET(req)

    expect(res.status).toBe(401)
    expect(refreshCalls).toBe(1)
    expect(forwardCalls).toBe(1) // original only — no retry after a failed refresh
    expect(mockSession.destroy).toHaveBeenCalledTimes(1)
    expect(mockSession.tokens).toBeUndefined()
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('unauthenticated')
  })

  it('when a sibling request already rotated the token, retries with the new token instead of destroying the session', async () => {
    // Concurrent-401 race: this request reads refresh-1, but by the time its own
    // refresh is rejected (a sibling already rotated the family, reuse-detected),
    // the session holds a freshly-rotated pair. The proxy must re-read the
    // session, notice the refresh token changed, and retry with the new access
    // token — NOT sign the user out over a lost race.
    const staleSession = {
      tokens: { access_token: 'access-1', refresh_token: 'refresh-1', expires_at: Date.now() + 900_000 } as SessionTokens,
      save: vi.fn(async () => {}),
      destroy: vi.fn()
    }
    const rotatedSession = {
      tokens: { access_token: 'access-2', refresh_token: 'refresh-2', expires_at: Date.now() + 900_000 } as SessionTokens,
      save: vi.fn(async () => {}),
      destroy: vi.fn()
    }
    // First getSession() (top of handler) sees the stale pair; the re-read in the
    // refresh-failure catch sees the sibling's rotated pair.
    vi.mocked(getSession)
      .mockResolvedValueOnce(staleSession as never)
      .mockResolvedValueOnce(rotatedSession as never)

    let forwardCalls = 0
    const fetchMock = vi.fn<FetchFn>().mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/auth/refresh')) {
        // our own refresh loses the race — the family was already revoked
        return jsonResponse(401, errorBody('users.invalid_refresh_token'))
      }
      forwardCalls++
      return forwardCalls === 1
        ? jsonResponse(401, errorBody('unauthenticated'))
        : jsonResponse(200, { data: [], next_cursor: null })
    })
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/users/', {
      method: 'GET',
      headers: { 'sec-fetch-site': 'same-origin' }
    })
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(forwardCalls).toBe(2) // original + one retry with the sibling's token
    expect(staleSession.destroy).not.toHaveBeenCalled() // session NOT torn down
    // the retry used the token the sibling rotated in, not the stale one
    const retryInit = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1]
    expect(new Headers(retryInit?.headers).get('authorization')).toBe('Bearer access-2')
  })

  it('relays the 401 straight through without refreshing when the session holds no refresh token', async () => {
    mockSession.tokens = undefined // anonymous / expired session
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(401, errorBody('unauthenticated')))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/users/', {
      method: 'GET',
      headers: { 'sec-fetch-site': 'same-origin' }
    })
    const res = await GET(req)

    expect(res.status).toBe(401)
    // exactly one call — the forward; the refresh endpoint was never hit
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/v1/auth/refresh'))).toBe(false)
    expect(mockSession.destroy).not.toHaveBeenCalled()
  })
})

describe('backend proxy — backend unreachable', () => {
  it('returns a clean 502 envelope when the initial forward fetch rejects (backend down / DNS / timeout)', async () => {
    const fetchMock = vi.fn<FetchFn>().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/users/', {
      method: 'GET',
      headers: { 'sec-fetch-site': 'same-origin' }
    })
    const res = await GET(req)

    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('internal_error')
  })
})

describe('backend proxy — CSRF defense', () => {
  it('rejects a cross-site mutating request with 403 and never calls the backend', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(200))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/users/', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x', email: 'a@b.c', password: 'secret12' })
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows a same-origin mutating request through to the backend', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(201, { id: '1', email: 'a@b.c', name: 'x', created_at: '2020-01-01T00:00:00Z' }))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/posts/', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'hi' })
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend.test/v1/posts/')
  })

  it('falls back to the Origin host when Sec-Fetch-Site is absent — same host allowed', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(201, { id: '1' }))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/posts/', {
      method: 'POST',
      // no sec-fetch-site header — old browser / non-browser client
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'hi' })
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the Origin host when Sec-Fetch-Site is absent — different host rejected', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(201))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/posts/', {
      method: 'POST',
      headers: { origin: 'http://evil.example.com', 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'hi' })
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a mutation with neither Sec-Fetch-Site nor Origin (absence of both is suspicious)', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(201))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/posts/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'hi' })
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a mutation with a malformed Origin (new URL throws) instead of crashing', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(201))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/backend/v1/posts/', {
      method: 'POST',
      headers: { origin: 'not-a-valid-url', 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'hi' })
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
