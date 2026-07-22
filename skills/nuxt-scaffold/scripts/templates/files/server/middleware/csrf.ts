import { API_PREFIX, isCrossSiteMutation } from '../utils/proxy'

// CSRF defense for every cookie-authenticated server route (ADR §7). This app's
// routes all live under /api/ and are authenticated by the sealed session
// cookie, so a state-changing request must prove it originated from this app's
// own origin. Gating the whole /api/ surface — not just the /api/backend proxy —
// means the session-establishing auth routes (/api/login, /api/signup,
// /api/logout in the saas template) are covered too: without this, an attacker's
// page could auto-submit a no-JS, no-preflight form POST to /api/login and
// silently log a victim into the attacker's account (login CSRF). Any future
// auth-adjacent route is covered automatically rather than needing an allowlist
// entry. Runs for every template (the proxy ships in the base preset). Safe
// methods (GET/HEAD/OPTIONS) pass through regardless of origin.
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (!url.pathname.startsWith(API_PREFIX)) return

  const rejected = isCrossSiteMutation(
    event.method,
    getHeader(event, 'sec-fetch-site'),
    getHeader(event, 'origin'),
    url.host
  )
  if (rejected) {
    throw createError({ statusCode: 403, statusMessage: 'cross-origin request rejected' })
  }
})
