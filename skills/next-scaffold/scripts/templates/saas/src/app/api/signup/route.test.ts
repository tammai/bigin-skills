import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SessionData } from '@/lib/session'
import { POST } from './route'

let mockSession: SessionData & { save: ReturnType<typeof vi.fn>, destroy: ReturnType<typeof vi.fn> }

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => mockSession)
}))

const BACKEND = 'http://backend.test'
const USER = { id: 7, email: 'new@example.com', full_name: 'New User', role: 'user' }

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
      if (String(url).endsWith('/auth/signup')) {
        return jsonResponse(201, USER)
      }
      // the follow-up login
      return jsonResponse(200, { access_token: 'a1', refresh_token: 'r1', user: USER })
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ full_name: 'New User', email: 'new@example.com', password: 'secret12' }))

    expect(res.status).toBe(201)
    // signup (create) then login — two backend calls, in order
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend.test/api/v1/auth/signup')
    expect(fetchMock.mock.calls[1][0]).toBe('http://backend.test/api/v1/auth/login')
    expect(mockSession.user).toEqual(USER)
    expect(mockSession.tokens?.access_token).toBe('a1')
    expect(mockSession.save).toHaveBeenCalledTimes(1)
  })

  it('surfaces a clean 409 when the email is already taken and does not log in', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(409, { error: 'duplicate key value violates unique constraint' })
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ full_name: 'Xy', email: 'dup@example.com', password: 'secret12' }))

    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('users.email_taken')
    expect(JSON.stringify(body)).not.toContain('duplicate key') // backend message not forwarded
    // only the create call happened — no login attempted after the failure
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockSession.save).not.toHaveBeenCalled()
  })

  it('maps a backend 400 (its validation status) to a clean validation_failed 400', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(400, { error: 'Key: SignUpRequest.Password failed on the min tag' }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ full_name: 'Xy', email: 'new@example.com', password: 'secret12' }))

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
    expect(JSON.stringify(body)).not.toContain('SignUpRequest') // backend message not forwarded
    expect(mockSession.save).not.toHaveBeenCalled()
  })

  it('rejects a malformed body with 422 and never calls the backend', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ full_name: '', email: 'bad', password: 'x' }))

    expect(res.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes a 4xx BackendError status outside {400,409} straight through (e.g. 429)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, { error: 'too many requests' })
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ full_name: 'Xy', email: 'new@example.com', password: 'secret12' }))

    expect(res.status).toBe(429) // 4xx passthrough branch
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('backend_error')
    expect(JSON.stringify(body)).not.toContain('too many') // backend message not forwarded
    expect(mockSession.save).not.toHaveBeenCalled()
  })

  it('maps a 5xx BackendError to a 502 (e.g. 503)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(503, { error: 'down' })
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest({ full_name: 'Xy', email: 'new@example.com', password: 'secret12' }))

    expect(res.status).toBe(502) // 5xx collapses to 502
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('backend_error')
    expect(mockSession.save).not.toHaveBeenCalled()
  })
})
