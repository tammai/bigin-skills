import { resolveBackendUrl } from '../utils/backend'
import { performLogout, type SessionWriter } from '../utils/auth-flow'

// Local logout must ALWAYS succeed: if the backend is slow, down, or even
// unconfigured, the user still expects to be signed out here, and any dangling
// refresh token expires on its own server-side. performLogout does best-effort
// backend revocation, then tears down the local session regardless.
export default defineEventHandler(async (event) => {
  const { secure } = await getUserSession(event)
  const write: SessionWriter = {
    setUser: async () => {},
    clear: async () => { await clearUserSession(event) }
  }
  let base: string | undefined
  try {
    base = resolveBackendUrl(useRuntimeConfig(event).backendUrl)
  } catch {
    // NUXT_BACKEND_URL not set — skip revocation, still clear locally below.
  }
  if (base) await performLogout(base, secure?.tokens, write)
  else await write.clear()
  return { ok: true }
})
