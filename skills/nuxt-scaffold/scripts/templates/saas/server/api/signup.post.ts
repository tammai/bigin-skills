import { z } from 'zod'
import { resolveBackendUrl } from '../utils/backend'
import { performSignup, signupErrorResponse, type SessionWriter } from '../utils/auth-flow'

const SignupBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const parsed = SignupBody.safeParse(await readBody(event))
  if (!parsed.success) {
    setResponseStatus(event, 422)
    return { error: { code: 'validation_failed', message: 'Invalid request body' } }
  }

  const { name, email, password } = parsed.data
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
    const user = await performSignup(base, name, email, password, write)
    setResponseStatus(event, 201)
    return { id: user.id, email: user.email, name: user.name }
  } catch (err) {
    // Never forward the raw backend body — see signupErrorResponse for the
    // status/code mapping (unit-tested directly).
    const { status, body } = signupErrorResponse(err)
    setResponseStatus(event, status)
    return body
  }
})
