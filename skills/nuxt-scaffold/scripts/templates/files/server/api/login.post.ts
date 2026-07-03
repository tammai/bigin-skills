import { z } from 'zod'

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = LoginBody.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid request body' })
  }
  const { email, password } = parsed.data
  const backendUrl = useRuntimeConfig().backendUrl
  if (!backendUrl) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_BACKEND_URL is not configured' })
  }
  let auth
  try {
    auth = await $fetch<{ id: number, email: string, token: string }>(
      `${backendUrl}/login`,
      { method: 'POST', body: { email, password } }
    )
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }
  await setUserSession(event, {
    user: { id: auth.id, email: auth.email },
    secure: { token: auth.token }
  })
  return { id: auth.id, email: auth.email }
})
