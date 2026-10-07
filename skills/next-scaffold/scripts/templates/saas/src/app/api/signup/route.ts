import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { backendSignup, backendLogin } from '@/lib/backend'
import { signupErrorResponse } from '@/lib/auth-errors'

const SignupBody = z.object({
  full_name: z.string().min(2).max(100),
  email: z.email(),
  password: z.string().min(8)
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = SignupBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'validation_failed', message: 'Invalid request body' } }, { status: 422 })
  }
  const { full_name, email, password } = parsed.data
  try {
    // POST /auth/signup creates the account but does NOT log you in (no tokens) —
    // follow it with a login call, reusing the same credentials, to obtain the
    // token pair before saving the session.
    await backendSignup(full_name, email, password)
    const { tokens, user } = await backendLogin(email, password)
    const session = await getSession()
    session.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
    session.tokens = tokens
    await session.save()
    return NextResponse.json(session.user, { status: 201 })
  } catch (err) {
    return signupErrorResponse(err)
  }
}
