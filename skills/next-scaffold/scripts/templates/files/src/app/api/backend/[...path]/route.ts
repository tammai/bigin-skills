import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { backendUrl, backendRefresh } from '@/lib/backend'
import { isCrossSiteMutation } from '@/lib/csrf'

// ── The BFF backend proxy ────────────────────────────────────────────────
// The single mechanism the browser uses to reach the backend. Every
// client-side call goes to same-origin /api/backend/<path>; this handler:
//   1. rejects cross-site mutations (CSRF defense, ADR §7),
//   2. unseals the session cookie and attaches Authorization: Bearer,
//   3. forwards the request faithfully to BACKEND_URL,
//   4. on a 401, refreshes the token once and retries (ADR §7.3).
//
// It is a *version-agnostic passthrough*: the incoming path after /api/backend
// (e.g. /v1/users/) is forwarded verbatim to `${BACKEND_URL}<path>`. The API
// version lives in the path, not in this file — so a future /v2/* route needs
// no change here, and the generated openapi-fetch client's path keys line up
// 1:1 with what the backend actually serves (including trailing slashes).

const BFF_PREFIX = '/api/backend'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function json(code: string, message: string, status: number): NextResponse {
  // Mirrors the backend's nested error envelope so client code sees one shape.
  return NextResponse.json({ error: { code, message } }, { status })
}

async function forward(targetUrl: string, method: string, headers: Headers, body: ArrayBuffer | undefined, accessToken: string | undefined): Promise<Response> {
  const outHeaders = new Headers(headers)
  outHeaders.delete('host')
  outHeaders.delete('cookie') // never leak the sealed session cookie to the backend
  outHeaders.delete('content-length') // recomputed by fetch
  if (accessToken) outHeaders.set('authorization', `Bearer ${accessToken}`)
  else outHeaders.delete('authorization')
  return fetch(targetUrl, { method, headers: outHeaders, body, redirect: 'manual', cache: 'no-store' })
}

async function relay(res: Response): Promise<NextResponse> {
  const buf = await res.arrayBuffer()
  const out = new NextResponse(res.status === 204 ? null : buf, { status: res.status })
  const contentType = res.headers.get('content-type')
  if (contentType) out.headers.set('content-type', contentType)
  return out
}

async function handle(request: NextRequest, method: string): Promise<NextResponse> {
  if (isCrossSiteMutation(request)) {
    return json('unauthorized', 'cross-origin request rejected', 403)
  }

  let base: string
  try {
    base = backendUrl()
  } catch {
    return json('internal_error', 'BACKEND_URL is not configured', 500)
  }

  const { pathname, search } = request.nextUrl
  const backendPath = pathname.slice(BFF_PREFIX.length) || '/'
  const targetUrl = `${base}${backendPath}${search}`

  const session = await getSession()
  // Read the body once so it can be replayed on the refresh-retry below.
  const body = SAFE_METHODS.has(method) ? undefined : await request.arrayBuffer()

  let res: Response
  try {
    res = await forward(targetUrl, method, request.headers, body, session.tokens?.access_token)
  } catch {
    // fetch threw before any response (backend down / DNS / timeout). Return the
    // file's own error envelope rather than letting it escape as an uncaught 500.
    return json('internal_error', 'backend unreachable', 502)
  }

  // 401 → refresh → retry once (ADR §7.3). Only if we actually hold a refresh token.
  if (res.status === 401 && session.tokens?.refresh_token) {
    const attemptedRefreshToken = session.tokens.refresh_token
    try {
      session.tokens = await backendRefresh(attemptedRefreshToken)
      await session.save()
      res = await forward(targetUrl, method, request.headers, body, session.tokens.access_token)
    } catch {
      // Refresh failed — but before signing the user out, rule out a lost race.
      // Two requests sharing one session can both hit a 401 and both read the
      // same refresh_token; only one wins the rotate, and a backend with
      // reuse-detection revokes the token family when the loser replays the now
      // stale token (see nodejs-scaffold's refresh.ts). Re-read the session: if
      // the refresh_token has since changed, a sibling already rotated it
      // successfully, so retry the original forward with the current access
      // token instead of destroying a session that is actually still valid.
      const fresh = await getSession()
      if (fresh.tokens?.refresh_token && fresh.tokens.refresh_token !== attemptedRefreshToken) {
        res = await forward(targetUrl, method, request.headers, body, fresh.tokens.access_token)
      } else {
        // Genuinely the same stale token — the refresh really did fail (expired
        // / reuse-detected). Clear the session so the next request
        // re-authenticates, and tell the client it's unauthenticated.
        session.destroy()
        return json('unauthenticated', 'session expired, please sign in again', 401)
      }
    }
  }

  return relay(res)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request, 'GET')
}
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request, 'POST')
}
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return handle(request, 'PATCH')
}
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return handle(request, 'DELETE')
}
