import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SessionData } from '@/lib/session'
import { POST } from './route'

let mockSession: SessionData & { save: ReturnType<typeof vi.fn>, destroy: ReturnType<typeof vi.fn> }

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => mockSession)
}))

const BACKEND = 'http://backend.test'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function signupRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/signup', {
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

describe('POST /api/signup', () => {
  it('creates the user, then logs in, then populates the session', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url).endsWith('/v1/users/')) {
        return jsonResponse(201, { id: 'u1', email: 'new@example.com', name: 'New User', created_at: '2020-01-01T00:00:00Z' })
      }
      // the follow-up login
      return jsonResponse(200, { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer', expires_in: 900 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ name: 'New User', email: 'new@example.com', password: 'secret12' }))

    expect(res.status).toBe(201)
    // signup (create) then login — two backend calls, in order
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend.test/v1/users/')
    expect(fetchMock.mock.calls[1][0]).toBe('http://backend.test/v1/auth/login')
    expect(mockSession.user).toEqual({ id: 'u1', email: 'new@example.com', name: 'New User' })
    expect(mockSession.tokens?.access_token).toBe('a1')
    expect(mockSession.save).toHaveBeenCalledTimes(1)
  })

  it('surfaces a clean 409 when the email is already taken and does not log in', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(409, { error: { code: 'users.email_taken', message: 'taken', request_id: 'req-9' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ name: 'X', email: 'dup@example.com', password: 'secret12' }))

    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string, request_id?: string } }
    expect(body.error.code).toBe('users.email_taken')
    expect(body.error.request_id).toBeUndefined()
    // only the create call happened — no login attempted after the failure
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockSession.save).not.toHaveBeenCalled()
  })

  it('rejects a malformed body with 422 and never calls the backend', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ name: '', email: 'bad', password: 'x' }))

    expect(res.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes a 4xx BackendError status outside {409,422} straight through (e.g. 429)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, { error: { code: 'users.rate_limited', message: 'slow down', request_id: 'req-9' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ name: 'X', email: 'new@example.com', password: 'secret12' }))

    expect(res.status).toBe(429) // 4xx passthrough branch
    const body = (await res.json()) as { error: { code: string, request_id?: string } }
    expect(body.error.code).toBe('users.rate_limited')
    expect(body.error.request_id).toBeUndefined() // backend internals not forwarded
    expect(mockSession.save).not.toHaveBeenCalled()
  })

  it('maps a 5xx BackendError to a 502 (e.g. 503)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(503, { error: { code: 'service_unavailable', message: 'down', request_id: 'req-9' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ name: 'X', email: 'new@example.com', password: 'secret12' }))

    expect(res.status).toBe(502) // 5xx collapses to 502
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('service_unavailable')
    expect(mockSession.save).not.toHaveBeenCalled()
  })
})
