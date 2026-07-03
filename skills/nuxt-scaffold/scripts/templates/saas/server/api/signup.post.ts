import { z } from 'zod'

const SignupBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = SignupBody.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid request body' })
  }
  // Demo auth — no backend wired yet; see server/api/login.post.ts.
  await setUserSession(event, { user: { email: parsed.data.email, name: parsed.data.name } })
  return { email: parsed.data.email, name: parsed.data.name }
})
