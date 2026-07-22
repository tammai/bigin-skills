import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { performLogin, performSignup, performLogout, loginErrorResponse, signupErrorResponse, type SessionWriter } from '~~/server/utils/auth-flow'
import { BackendError } from '~~/server/utils/backend'
import type { SessionTokens } from '~~/shared/types/session'

// The auth flows are h3-free — they take a SessionWriter and use the global fetch
// (stubbed here). Mirrors Phase 2's login/signup route tests: assert the backend
// call order + URLs, what got written to the session, and that a backend failure
// aborts before any session write.

const BACKEND = 'http://backend.test'

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function tokenPair() {
  return { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer', expires_in: 900 }
}

let write: SessionWriter & { setUser: ReturnType<typeof vi.fn>, clear: ReturnType<typeof vi.fn> }

beforeEach(() => {
  write = {
    setUser: vi.fn(async () => {}),
    clear: vi.fn(async () => {})
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('performLogin', () => {
  it('on valid creds, stores the email + token pair in the session', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(200, tokenPair()))
    vi.stubGlobal('fetch', fetchMock)

    const result = await performLogin(BACKEND, 'user@example.com', 'secret12', write)

    expect(result).toEqual({ email: 'user@example.com' })
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend.test/v1/auth/login')
    expect(write.setUser).toHaveBeenCalledTimes(1)
    const [user, tokens] = write.setUser.mock.calls[0] as [{ email: string }, SessionTokens]
    expect(user).toEqual({ email: 'user@example.com' })
    expect(tokens.access_token).toBe('a1')
    expect(typeof tokens.expires_at).toBe('number')
  })

  it('throws a BackendError on bad creds and writes nothing to the session', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(
      jsonResponse(401, { error: { code: 'users.invalid_credentials', message: 'nope', request_id: 'req-9' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(performLogin(BACKEND, 'user@example.com', 'secret12', write)).rejects.toMatchObject({ status: 401 })
    expect(write.setUser).not.toHaveBeenCalled()
  })
})

describe('performSignup', () => {
  it('creates the user, then logs in, then writes the full user + tokens', async () => {
    const fetchMock = vi.fn<FetchFn>().mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/users')) {
        return jsonResponse(201, { id: 'u1', email: 'new@example.com', name: 'New User', created_at: '2020-01-01T00:00:00Z' })
      }
      return jsonResponse(200, tokenPair()) // the follow-up login
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = await performSignup(BACKEND, 'New User', 'new@example.com', 'secret12', write)

    expect(user.id).toBe('u1')
    // create (POST /v1/users — no trailing slash, no Idempotency-Key) then login, in order
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend.test/v1/users')
    expect(fetchMock.mock.calls[1][0]).toBe('http://backend.test/v1/auth/login')
    // the create call carries no idempotency-key header (Go backend has no such middleware)
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('idempotency-key')).toBe(false)
    expect(write.setUser).toHaveBeenCalledTimes(1)
    expect(write.setUser.mock.calls[0][0]).toEqual({ id: 'u1', email: 'new@example.com', name: 'New User' })
  })

  it('aborts on a 409 email-taken without attempting login or writing the session', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(
      jsonResponse(409, { error: { code: 'users.email_taken', message: 'taken', request_id: 'req-9' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(performSignup(BACKEND, 'X', 'dup@example.com', 'secret12', write)).rejects.toBeInstanceOf(BackendError)
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the create call — no login after failure
    expect(write.setUser).not.toHaveBeenCalled()
  })
})

describe('performLogout', () => {
  it('revokes on the backend then clears the local session', async () => {
    const fetchMock = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(204))
    vi.stubGlobal('fetch', fetchMock)

    const tokens: SessionTokens = { access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() + 900_000 }
    await performLogout(BACKEND, tokens, write)

    expect(fetchMock.mock.calls[0][0]).toBe('http://backend.test/v1/auth/logout')
    expect(write.clear).toHaveBeenCalledTimes(1)
  })

  it('still clears the local session even when the backend revocation throws', async () => {
    const fetchMock = vi.fn<FetchFn>().mockRejectedValue(new Error('backend down'))
    vi.stubGlobal('fetch', fetchMock)

    const tokens: SessionTokens = { access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() + 900_000 }
    await performLogout(BACKEND, tokens, write)

    expect(write.clear).toHaveBeenCalledTimes(1)
  })

  it('with no session tokens, clears locally and never calls the backend', async () => {
    // logout.post.ts passes secure?.tokens, which is genuinely undefined when the
    // session has no token pair — the backend revocation must be skipped entirely.
    const fetchMock = vi.fn<FetchFn>()
    vi.stubGlobal('fetch', fetchMock)

    await performLogout(BACKEND, undefined, write)

    expect(fetchMock).not.toHaveBeenCalled() // backendLogout skipped
    expect(write.clear).toHaveBeenCalledTimes(1)
  })
})

// login.post.ts/signup.post.ts's status-code/error-code branching, extracted as
// pure functions so it's directly testable — no h3/Nitro auto-import stubbing
// needed (route.post.ts just calls these and forwards status/body verbatim).
describe('loginErrorResponse', () => {
  it('maps a 401 BackendError to 401 unauthenticated', () => {
    const res = loginErrorResponse(new BackendError(401, 'users.invalid_credentials', 'nope'))
    expect(res).toEqual({ status: 401, body: { error: { code: 'unauthenticated', message: 'Invalid email or password' } } })
  })

  it('collapses any other BackendError status to 502 unauthenticated', () => {
    const res = loginErrorResponse(new BackendError(500, 'internal', 'nope'))
    expect(res).toEqual({ status: 502, body: { error: { code: 'unauthenticated', message: 'Invalid email or password' } } })
  })

  it('maps a non-BackendError (raw network exception) to 502 internal_error', () => {
    const res = loginErrorResponse(new Error('backend unreachable'))
    expect(res).toEqual({ status: 502, body: { error: { code: 'internal_error', message: 'Login failed, try again' } } })
  })
})

describe('signupErrorResponse', () => {
  it('maps a 409 BackendError to users.email_taken', () => {
    const res = signupErrorResponse(new BackendError(409, 'users.email_taken', 'taken'))
    expect(res).toEqual({ status: 409, body: { error: { code: 'users.email_taken', message: 'That email is already registered' } } })
  })

  it('maps a 422 BackendError to validation_failed', () => {
    const res = signupErrorResponse(new BackendError(422, 'validation_failed', 'bad'))
    expect(res).toEqual({ status: 422, body: { error: { code: 'validation_failed', message: 'Invalid sign-up details' } } })
  })

  it('passes through another 4xx with the backend error code', () => {
    const res = signupErrorResponse(new BackendError(403, 'forbidden', 'nope'))
    expect(res).toEqual({ status: 403, body: { error: { code: 'forbidden', message: 'Sign up failed' } } })
  })

  it('maps a 5xx BackendError to 502, keeping the backend error code', () => {
    const res = signupErrorResponse(new BackendError(500, 'internal', 'nope'))
    expect(res).toEqual({ status: 502, body: { error: { code: 'internal', message: 'Sign up failed' } } })
  })

  it('maps a non-BackendError (raw network exception) to 502 internal_error', () => {
    const res = signupErrorResponse(new Error('backend unreachable'))
    expect(res).toEqual({ status: 502, body: { error: { code: 'internal_error', message: 'Sign up failed, try again' } } })
  })
})
