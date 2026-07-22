import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SessionData } from '@/lib/session'
import { POST } from './route'

// getSession is mocked so the test owns the session object and can assert what
// login wrote into it. The backend call goes through global.fetch (stubbed).
let mockSession: SessionData & { save: ReturnType<typeof vi.fn>, destroy: ReturnType<typeof vi.fn> }

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => mockSession)
}))

const BACKEND = 'http://backend.test'

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function loginRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

beforeEach(() => {
  process.env.BACKEND_URL = BACKEND
  mockSession = { save: vi.fn(async () => {}), destroy: vi.fn() }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/login', () => {
  it('on a valid login, stores the token pair + email in the session', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(
      jsonResponse(200, { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer', expires_in: 900 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(loginRequest({ email: 'user@example.com', password: 'secret12' }))

    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend.test/v1/auth/login')
    expect(mockSession.tokens?.access_token).toBe('a1')
    expect(mockSession.tokens?.refresh_token).toBe('r1')
    expect(typeof mockSession.tokens?.expires_at).toBe('number')
    expect(mockSession.user?.email).toBe('user@example.com')
    expect(mockSession.save).toHaveBeenCalledTimes(1)
  })

  it('surfaces a clean 401 on bad credentials without leaking the backend body', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { error: { code: 'users.invalid_credentials', message: 'wrong', request_id: 'req-9' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(loginRequest({ email: 'user@example.com', password: 'secret12' }))

    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string, message: string, request_id?: string } }
    expect(body.error.code).toBe('unauthenticated')
    expect(body.error.request_id).toBeUndefined() // backend internals not forwarded
    expect(mockSession.save).not.toHaveBeenCalled()
    expect(mockSession.tokens).toBeUndefined()
  })

  it('rejects a malformed body with 422 and never calls the backend', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(loginRequest({ email: 'not-an-email', password: 'x' }))

    expect(res.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a generic 502 when the backend call throws a raw network error (not a BackendError)', async () => {
    // fetch itself rejects (backend unreachable / DNS / timeout) — this is NOT a
    // BackendError, so the route must fall through to the catch block's generic
    // 502 fallback rather than the BackendError status-mapping branch.
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(loginRequest({ email: 'user@example.com', password: 'secret12' }))

    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('internal_error')
    expect(mockSession.save).not.toHaveBeenCalled()
  })
})
