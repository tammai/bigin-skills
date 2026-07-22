import createClient from 'openapi-fetch'
import type { paths } from './schema'

// Typed client for the backend contract. `paths` is generated from the
// backend's OpenAPI document (openapi.json) by `pnpm openapi:generate` — do not
// hand-edit schema.d.ts.
//
// baseUrl is the SAME-ORIGIN BFF proxy, never BACKEND_URL: the browser only
// ever talks to /api/backend/*, which unseals the session cookie, attaches the
// Bearer token, handles the 401→refresh→retry flow, and forwards to the real
// backend. The proxy is a faithful passthrough, so the path keys here (e.g.
// '/v1/users/') are exactly the backend's paths.
//
// Server components / route handlers that need the backend directly use
// src/lib/backend.ts instead — this client is for browser (client component)
// code, reached through TanStack Query hooks in src/features/<feature>/hooks/.
export const apiClient = createClient<paths>({ baseUrl: '/api/backend' })
