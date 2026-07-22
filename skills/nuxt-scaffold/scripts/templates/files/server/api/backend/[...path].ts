import { resolveBackendUrl } from '../../utils/backend'
import { BFF_PREFIX, SAFE_METHODS, proxyToBackend, type ProxySession } from '../../utils/proxy'

// Method-agnostic catch-all: a single [...path].ts (no .get/.post suffix) handles
// every method Nitro routes to it — we branch on event.method inside. This is the
// ONE mechanism the browser uses to reach the Go backend: every client-side call
// goes to same-origin /api/backend/<path>, which unseals the nuxt-auth-utils
// session, attaches Authorization: Bearer, forwards to NUXT_BACKEND_URL, and runs
// the 401→refresh→retry-once flow. (Cross-site mutations are rejected earlier by
// server/middleware/csrf.ts.) The refresh token pair lives only in the session's
// server-only `secure` key — never sent to the browser.

export default defineEventHandler(async (event) => {
  let base: string
  try {
    base = resolveBackendUrl(useRuntimeConfig(event).backendUrl)
  } catch {
    setResponseStatus(event, 500)
    return { error: { code: 'internal_error', message: 'NUXT_BACKEND_URL is not configured' } }
  }

  const url = getRequestURL(event)
  const path = url.pathname.slice(BFF_PREFIX.length) || '/'
  const method = event.method

  // nuxt-auth-utils: the token pair lives under the server-only `secure` key
  // (getUserSession returns it server-side; useUserSession() never exposes it).
  const current = await getUserSession(event)
  const session: ProxySession = {
    tokens: current.secure?.tokens,
    save: async (tokens) => { await setUserSession(event, { secure: { tokens } }) },
    reload: async () => (await getUserSession(event)).secure?.tokens,
    clear: async () => { await clearUserSession(event) }
  }

  // Read the body once (as bytes) so it can be replayed on the refresh-retry.
  const raw = SAFE_METHODS.has(method) ? null : await readRawBody(event, false)
  const body = raw ? new Uint8Array(raw).slice().buffer : undefined

  const result = await proxyToBackend({
    base,
    method,
    path,
    search: url.search,
    headers: event.headers,
    body,
    session
  })

  setResponseStatus(event, result.status)
  if (result.contentType) setResponseHeader(event, 'content-type', result.contentType)
  return result.body ? Buffer.from(result.body) : null
})
