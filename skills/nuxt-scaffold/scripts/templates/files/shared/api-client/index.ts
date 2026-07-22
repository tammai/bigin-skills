import createClient from 'openapi-fetch'
import type { paths } from './schema'

// Typed client for the Go backend contract. `paths` is generated from openapi.yaml
// (a committed snapshot of the paired go-scaffold's api/openapi.yaml) by
// `pnpm openapi-types` — do not hand-edit schema.d.ts.
//
// baseUrl is the SAME-ORIGIN BFF proxy, never NUXT_BACKEND_URL: the browser only
// ever talks to /api/backend/*, which unseals the session cookie, attaches the
// Bearer token, handles the 401→refresh→retry flow, and forwards to the real
// backend. The proxy is a faithful passthrough, so the path keys here (e.g.
// '/v1/users') are exactly the backend's paths.
//
// Server code that needs the backend directly (auth routes, the proxy's refresh
// step) uses server/utils/backend.ts instead — this client is for browser code,
// reached through the Pinia Colada composables in app/composables/queries/.
export const apiClient = createClient<paths>({ baseUrl: '/api/backend' })
