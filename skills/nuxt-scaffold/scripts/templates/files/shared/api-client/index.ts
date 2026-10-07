import type { paths } from './schema'

// Typed client for the Go backend contract, built on Nuxt's global `$fetch`
// (ofetch) — no extra HTTP client dependency. Response shapes come from
// `paths`, generated from openapi.yaml (a committed snapshot of the paired
// go-scaffold's api/openapi.yaml) by `pnpm openapi-types` — do not hand-edit
// schema.d.ts.
//
// baseURL is the app's own /api — the same-origin pass-through (server/routes/api/
// [...path].ts), which forwards /api/v<N>/** to the API unchanged, so the paths passed
// here (e.g. '/v1/users') are the API's own paths minus the '/api' prefix. The browser
// holds no token: the API sets an HttpOnly session cookie that rides along because
// credentials are included. go-scaffold's contract omits the /v1 (its servers URL is
// /api/v1), so after replacing openapi.yaml with it, set baseURL to '/api/v1'.
//
// $fetch throws a FetchError on non-2xx — let it propagate; Pinia Colada turns
// it into the query's `error`. A 401 means the session ended or never existed.
// Reached through the Pinia Colada composables in app/composables/queries/.
export const apiClient = $fetch.create({ baseURL: '/api', credentials: 'include' })

/** JSON body of a 200 response, e.g. `Ok<'/v1/users'>` — pass it as `apiClient<Ok<'/v1/users'>>('/v1/users')`. */
export type Ok<P extends keyof paths, M extends 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get'>
  = paths[P] extends { [K in M]: { responses: { 200: { content: { 'application/json': infer R } } } } } ? R : never
