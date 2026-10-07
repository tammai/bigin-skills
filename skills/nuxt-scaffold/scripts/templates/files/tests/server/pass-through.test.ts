import { describe, it, expect, vi, afterEach } from 'vitest'
import { passThrough } from '~~/server/utils/pass-through'

// The pass-through is h3-free: it takes a web Request and the configured origin
// and uses the global fetch (stubbed here), so the allowlist and the forwarding
// policy are exercised without spinning up a Nitro server.

const ORIGIN = 'http://api.test:8090'

type FetchFn = (url: string | URL, init?: RequestInit & { duplex?: string }) => Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubFetch(res: Response | (() => Promise<Response>) = new Response('{}', { status: 200 })) {
  const fetchMock = vi.fn<FetchFn>().mockImplementation(typeof res === 'function' ? res : async () => res)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// A plain object, not `new Request(...)`: under the Nuxt test environment (happy-dom) the global
// Request follows browser rules and drops forbidden headers such as `cookie` — a real Node or
// Worker request keeps them, and that is what the pass-through must forward.
function req(path: string, init: { method?: string, headers?: Record<string, string>, body?: string } = {}) {
  const bytes = init.body === undefined ? undefined : new TextEncoder().encode(init.body)
  return {
    url: `http://app.test${path}`,
    method: init.method ?? 'GET',
    headers: new Headers(init.headers),
    body: bytes
      ? new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes)
            controller.close()
          }
        })
      : null
  }
}

async function errorCode(res: Response): Promise<string> {
  return ((await res.json()) as { error: { code: string } }).error.code
}

describe('pass-through — allowlist', () => {
  it.each([
    ['/api/v1/users?limit=20', `${ORIGIN}/api/v1/users?limit=20`],
    ['/api/v1', `${ORIGIN}/api/v1`],
    ['/api/v1/', `${ORIGIN}/api/v1/`],
    ['/api/v12/x', `${ORIGIN}/api/v12/x`],
    ['/api/v1/users/', `${ORIGIN}/api/v1/users/`], // trailing slash forwarded as written
    ['/api/v1/auth/session', `${ORIGIN}/api/v1/auth/session`]
  ])('forwards %s to the API origin verbatim', async (path, expected) => {
    const fetchMock = stubFetch()
    const res = await passThrough(req(path), ORIGIN)
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(expected)
  })

  it.each([
    '/api',
    '/api/',
    '/api/v/x',
    '/api/v1x/y',
    '/api/vX/y',
    '/api/foo',
    '/api/V1/x',
    '/apix/v1/x',
    '/v1/users',
    '/api//v1/x', // repeated slash does not normalize into the allowlist
    '/api/%2e%2e/x',
    '/api/v1/../admin',
    '/api/v1/%2e%2e/admin',
    '/api/v1/%2e%2e%2fadmin', // encoded slash hides a dot segment
    '/api/v1%2f..%2fadmin',
    '/api/v1/%5c..%5cadmin', // encoded backslash
    '/api/v1/%00',
    '/api/v1/%zz' // undecodable
  ])('returns a JSON 404 for %s and never reaches the API', async (path) => {
    const fetchMock = stubFetch()
    const res = await passThrough(req(path), ORIGIN)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await errorCode(res)).toBe('not_found')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('builds the upstream URL from the configured origin, validated path and client query only', async () => {
    const fetchMock = stubFetch()
    await passThrough(req('/api/v1//evil.test/x?next=http://evil.test@a'), ORIGIN)
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.origin).toBe(ORIGIN)
    expect(url.search).toBe('?next=http://evil.test@a')
  })

  it('tolerates a trailing slash on the configured origin', async () => {
    const fetchMock = stubFetch()
    await passThrough(req('/api/v1/users'), `${ORIGIN}/`)
    expect(fetchMock.mock.calls[0][0]).toBe(`${ORIGIN}/api/v1/users`)
  })
})

describe('pass-through — request forwarding', () => {
  it('forwards every request header except host, and adds no forwarding headers', async () => {
    const fetchMock = stubFetch()
    await passThrough(req('/api/v1/user/profile', {
      headers: {
        'host': 'app.test',
        'cookie': '__Host-session=abc',
        'x-request-id': 'req-1',
        'authorization': 'Bearer t',
        'origin': 'https://app.test'
      }
    }), ORIGIN)
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(headers.get('host')).toBeNull()
    expect(headers.get('cookie')).toBe('__Host-session=abc')
    expect(headers.get('x-request-id')).toBe('req-1')
    expect(headers.get('authorization')).toBe('Bearer t')
    expect(headers.get('origin')).toBe('https://app.test')
    expect(headers.get('x-forwarded-for')).toBeNull()
    expect(headers.get('x-forwarded-host')).toBeNull()
    expect(headers.get('cf-connecting-ip')).toBeNull()
  })

  it('does not follow redirects and streams the request body without buffering it', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 201 }))
    const res = await passThrough(req('/api/v1/auth/session', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.c', password: 'secret123' }),
      headers: { 'content-type': 'application/json' }
    }), ORIGIN)
    expect(res.status).toBe(201)
    const init = fetchMock.mock.calls[0][1]
    expect(init?.method).toBe('POST')
    expect(init?.redirect).toBe('manual')
    expect(init?.duplex).toBe('half')
    expect(init?.body).toBeInstanceOf(ReadableStream)
  })

  it('sends no body for GET and HEAD', async () => {
    const fetchMock = stubFetch()
    await passThrough(req('/api/v1/users'), ORIGIN)
    await passThrough(req('/api/v1/users', { method: 'HEAD' }), ORIGIN)
    expect(fetchMock.mock.calls[0][1]?.body ?? null).toBeNull()
    expect(fetchMock.mock.calls[1][1]?.body ?? null).toBeNull()
  })
})

describe('pass-through — response forwarding', () => {
  it('returns the upstream status, headers and every Set-Cookie intact', async () => {
    const upstream = new Response('{"user":{}}', { status: 201, headers: { 'x-request-id': 'req-9' } })
    upstream.headers.append('set-cookie', '__Host-session=abc; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax')
    upstream.headers.append('set-cookie', 'other=1; Path=/')
    stubFetch(upstream)
    const res = await passThrough(req('/api/v1/auth/session', { method: 'POST', body: '{}' }), ORIGIN)
    expect(res.status).toBe(201)
    expect(res.headers.get('x-request-id')).toBe('req-9')
    expect(res.headers.getSetCookie()).toEqual([
      '__Host-session=abc; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax',
      'other=1; Path=/'
    ])
  })

  it('does not buffer the response body — a chunk arrives before the upstream finishes', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c
      }
    })
    stubFetch(new Response(stream, { headers: { 'content-type': 'text/event-stream' } }))
    const res = await passThrough(req('/api/v1/events'), ORIGIN)
    const reader = res.body!.getReader()
    controller.enqueue(new TextEncoder().encode('data: one\n\n'))
    const first = await reader.read() // would hang if the pass-through buffered until close
    expect(new TextDecoder().decode(first.value)).toBe('data: one\n\n')
    controller.close()
    expect((await reader.read()).done).toBe(true)
  })

  it('returns an upstream redirect as-is instead of following it', async () => {
    stubFetch(new Response(null, { status: 302, headers: { location: '/api/v1/elsewhere' } }))
    const res = await passThrough(req('/api/v1/x'), ORIGIN)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/api/v1/elsewhere')
  })

  it('passes 4xx responses through unchanged', async () => {
    stubFetch(new Response('{"error":{"code":"unauthenticated"}}', { status: 401, headers: { 'content-type': 'application/json' } }))
    const res = await passThrough(req('/api/v1/user/profile'), ORIGIN)
    expect(res.status).toBe(401)
    expect(await errorCode(res)).toBe('unauthenticated')
  })
})

describe('pass-through — failures', () => {
  it('turns an upstream 5xx into a JSON 502 without its body, URL or headers', async () => {
    stubFetch(new Response('panic at http://api.test:8090/internal/db', { status: 500, headers: { 'x-secret': 'leak' } }))
    const res = await passThrough(req('/api/v1/users'), ORIGIN)
    expect(res.status).toBe(502)
    expect(await errorCode(res.clone())).toBe('bad_gateway')
    const text = await res.text()
    expect(text).not.toContain('panic')
    expect(text).not.toContain('api.test')
    expect(res.headers.get('x-secret')).toBeNull()
  })

  it('turns a network error into a JSON 502 that does not leak the upstream URL', async () => {
    stubFetch(() => Promise.reject(new Error('connect ECONNREFUSED http://api.test:8090')))
    const res = await passThrough(req('/api/v1/users'), ORIGIN)
    expect(res.status).toBe(502)
    expect(await errorCode(res.clone())).toBe('bad_gateway')
    expect(await res.text()).not.toContain('api.test')
  })

  it.each([undefined, null, '', '   ', 'not a url', 'ftp://api.test', 42])('returns a JSON 502 upstream_not_configured for origin %j', async (origin) => {
    const fetchMock = stubFetch()
    const res = await passThrough(req('/api/v1/users'), origin)
    expect(res.status).toBe(502)
    expect(await errorCode(res)).toBe('upstream_not_configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still 404s a non-allowlisted path when the origin is unset', async () => {
    stubFetch()
    const res = await passThrough(req('/api/other'), undefined)
    expect(res.status).toBe(404)
  })
})
