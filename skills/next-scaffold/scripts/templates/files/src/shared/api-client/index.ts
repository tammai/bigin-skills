import createClient from 'openapi-fetch'
import type { paths } from './schema'

// Typed client for the API contract. `paths` is generated from the API's OpenAPI
// document (openapi.json, copied from go-scaffold's openapi.yaml) by
// `pnpm openapi:generate` — do not hand-edit schema.d.ts.
//
// baseUrl is the app's own /api/v1 — the same-origin pass-through (the rewrite in
// next.config.ts), which forwards /api/v<N>/** to the API unchanged, so the path
// keys here (e.g. '/user/profile') are the contract's own paths under go-scaffold's
// /api/v1 base. The browser holds no token: the API sets an HttpOnly session
// cookie that rides along because credentials are included. A 401 means the
// session ended or never existed. If the API's base path changes, change baseUrl
// (the rewrite already forwards any /api/v<digits>).
//
// `fetch` is late-bound: openapi-fetch would otherwise capture window.fetch when this module
// loads, and anything that replaces it afterwards (instrumentation, a test stub) would be skipped.
//
// Reached through TanStack Query hooks in src/features/<feature>/hooks/.
export const apiClient = createClient<paths>({
  baseUrl: '/api/v1',
  credentials: 'include',
  fetch: request => fetch(request)
})
