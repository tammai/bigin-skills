import { passThrough } from '../../utils/pass-through'

// Catch-all for /api/**: forwards /api/v<digits>/** to NUXT_API_ORIGIN and 404s the
// rest (see server/utils/pass-through.ts). Not routeRules: Nitro's proxy buffers
// streamed responses and can't express the version allowlist.
export default defineEventHandler(event => passThrough(toWebRequest(event), useRuntimeConfig(event).apiOrigin))
