// The browser's only door to the API: /api/v<digits>/** is forwarded to the
// server-only NUXT_API_ORIGIN (runtimeConfig.apiOrigin) and everything else under
// /api/ is a JSON 404. It holds no tokens and no session — the API owns the
// HttpOnly session cookie, and Set-Cookie / Cookie pass through unchanged.
//
// h3-free (a web Request in, a web Response out, global fetch) so the allowlist and
// the forwarding policy are unit-testable without a Nitro runtime.

// The allowlist is the only access control. It runs on the decoded path with dot
// segments rejected, so an encoded traversal can't reach another upstream path.
const API_PATH = /^\/api\/v\d+(\/|$)/

// Connection-scoped headers belong to this hop, not the next one.
const HOP_BY_HOP = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade']

function isAllowed(pathname: string): boolean {
  let path: string
  try {
    path = decodeURIComponent(pathname)
  } catch {
    return false
  }
  if (path.includes('\\') || path.includes('\0')) return false
  if (path.split('/').some(segment => segment === '.' || segment === '..')) return false
  return API_PATH.test(path)
}

function resolveOrigin(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined
  } catch {
    return undefined
  }
}

function errorResponse(status: number, code: string, message: string, requestId?: string | null): Response {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (requestId) headers.set('x-request-id', requestId)
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers })
}

// The part of a web Request this needs — a structural type, so a test can hand it a plain object
// (a happy-dom `Request` silently drops forbidden headers such as `cookie`).
type IncomingRequest = Pick<Request, 'url' | 'method' | 'headers' | 'body'>

export async function passThrough(request: IncomingRequest, apiOrigin: unknown): Promise<Response> {
  const url = new URL(request.url)
  if (!isAllowed(url.pathname)) return errorResponse(404, 'not_found', 'Not found')

  const origin = resolveOrigin(apiOrigin)
  if (!origin) return errorResponse(502, 'upstream_not_configured', 'NUXT_API_ORIGIN is not configured')

  const headers = new Headers(request.headers)
  for (const name of HOP_BY_HOP) headers.delete(name)
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const requestId = request.headers.get('x-request-id')

  try {
    const upstream = await fetch(`${origin}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      duplex: 'half',
      redirect: 'manual'
    } as RequestInit)
    if (upstream.status < 500) return upstream
    await upstream.body?.cancel()
  } catch {
    // network error — fall through to the same opaque 502
  }
  return errorResponse(502, 'bad_gateway', 'Upstream request failed', requestId)
}
