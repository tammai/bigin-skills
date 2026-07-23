import type { NextRequest } from 'next/server'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Same-origin check for state-changing requests (CSRF defense, ADR §7). A
// cookie-authenticated API is vulnerable to CSRF unless it verifies the
// request originated from its own site. Modern browsers send Sec-Fetch-Site on
// every request; fall back to an Origin host comparison for the rare client
// that doesn't. Shared by the backend proxy route and (in the saas template)
// the root proxy/middleware, so the two enforcement points can't drift.
export function isCrossSiteMutation(request: NextRequest): boolean {
  if (SAFE_METHODS.has(request.method)) return false
  const site = request.headers.get('sec-fetch-site')
  if (site) return !(site === 'same-origin' || site === 'none')
  const origin = request.headers.get('origin')
  if (!origin) return true // a browser mutation always sends Origin; absence is suspicious
  try {
    return new URL(origin).host !== request.nextUrl.host
  } catch {
    return true
  }
}
