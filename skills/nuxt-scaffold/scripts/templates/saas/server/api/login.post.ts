import { z } from 'zod'
import { resolveBackendUrl } from '../utils/backend'
import { performLogin, loginErrorResponse, type SessionWriter } from '../utils/auth-flow'

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const parsed = LoginBody.safeParse(await readBody(event))
  if (!parsed.success) {
    setResponseStatus(event, 422)
    return { error: { code: 'validation_failed', message: 'Invalid request body' } }
  }

  // Resolve the backend URL in its own guard (like the /api/backend proxy) so a
  // missing NUXT_BACKEND_URL returns the clean 500 envelope, not an uncaught throw.
  let base: string
  try {
    base = resolveBackendUrl(useRuntimeConfig(event).backendUrl)
  } catch {
    setResponseStatus(event, 500)
    return { error: { code: 'internal_error', message: 'NUXT_BACKEND_URL is not configured' } }
  }

  const write: SessionWriter = {
    setUser: async (user, tokens) => { await setUserSession(event, { user, secure: { tokens } }) },
    clear: async () => { await clearUserSession(event) }
  }

  try {
    return await performLogin(base, parsed.data.email, parsed.data.password, write)
  } catch (err) {
    // Never forward the raw backend body (request_id + internal phrasing) — see
    // loginErrorResponse for the status/code mapping (unit-tested directly).
    const { status, body } = loginErrorResponse(err)
    setResponseStatus(event, status)
    return body
  }
})
