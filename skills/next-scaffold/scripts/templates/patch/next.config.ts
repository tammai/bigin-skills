import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

// Lets `next dev` read Cloudflare bindings through wrangler's local proxy; a no-op in a build.
initOpenNextCloudflareForDev()

// The API origin the /api pass-through forwards to: scheme + host (+ port), nothing else.
// Server-only on purpose — a NEXT_PUBLIC_ name would ship the API's address to the browser.
// Next bakes a rewrite's destination into the build, so this is read when `next build` runs
// (`pnpm preview` / `pnpm deploy` build first); a Worker variable set later changes nothing.
function apiOrigin(): string {
  const raw = process.env.API_ORIGIN
  if (!raw) {
    throw new Error('API_ORIGIN is not set — the /api pass-through has nowhere to forward. Set it in .env (or the build environment) to the API origin, e.g. https://api.example.com')
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`API_ORIGIN is not a valid URL: ${JSON.stringify(raw)}`)
  }
  if (!/^https?:$/.test(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username) {
    throw new Error(`API_ORIGIN must be an origin only (scheme + host + optional port, no path), got ${JSON.stringify(raw)}`)
  }
  return url.origin
}

const nextConfig: NextConfig = {
  // The whole pass-through: browser -> /api/v<digits>/** -> the API, `Cookie` / `Set-Cookie` untouched.
  // No token is held and no logic runs here. The pattern is the only allowlist — /api/v1x, /api/v/…
  // and every other /api/* path match nothing and fall through to Next's 404.
  async rewrites() {
    return [{ source: '/api/v:ver(\\d+)/:path*', destination: `${apiOrigin()}/api/v:ver/:path*` }]
  }
}

export default nextConfig
