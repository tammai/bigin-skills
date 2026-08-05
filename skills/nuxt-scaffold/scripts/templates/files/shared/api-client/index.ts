import type { paths } from './schema'

// Typed client for the Go backend contract, built on Nuxt's global `$fetch`
// (ofetch) — no extra HTTP client dependency. Response shapes come from
// `paths`, generated from openapi.yaml (a committed snapshot of the paired
// go-scaffold's api/openapi.yaml) by `pnpm openapi-types` — do not hand-edit
// schema.d.ts.
//
// baseURL is the SAME-ORIGIN BFF proxy, never NUXT_BACKEND_URL: the browser only
// ever talks to /api/backend/*, which unseals the session cookie, attaches the
// Bearer token, handles the 401→refresh→retry flow, and forwards to the real
// backend. The proxy is a faithful passthrough, so the paths passed here (e.g.
// '/v1/users') are exactly the backend's paths.
//
// $fetch throws a FetchError on non-2xx — let it propagate; Pinia Colada turns
// it into the query's `error`.
//
// Server code that needs the backend directly (auth routes, the proxy's refresh
// step) uses server/utils/backend.ts instead — this client is for browser code,
// reached through the Pinia Colada composables in app/composables/queries/.
export const apiClient = $fetch.create({ baseURL: '/api/backend' })

/** JSON body of a 200 response, e.g. `Ok<'/v1/users'>` — pass it as `apiClient<Ok<'/v1/users'>>('/v1/users')`. */
export type Ok<P extends keyof paths, M extends 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get'>
  = paths[P] extends { [K in M]: { responses: { 200: { content: { 'application/json': infer R } } } } } ? R : never
