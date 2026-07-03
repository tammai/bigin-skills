import { z } from 'zod'

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = LoginBody.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid request body' })
  }
  // Demo auth — no backend wired yet. Any well-formed credentials succeed;
  // swap this (and server/api/signup.post.ts) for a real backend call before shipping.
  await setUserSession(event, { user: { email: parsed.data.email } })
  return { email: parsed.data.email }
})
