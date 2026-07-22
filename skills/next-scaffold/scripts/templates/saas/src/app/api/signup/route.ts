import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { backendSignup, backendLogin, BackendError } from '@/lib/backend'

const SignupBody = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8)
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = SignupBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'validation_failed', message: 'Invalid request body' } }, { status: 422 })
  }
  const { name, email, password } = parsed.data
  try {
    // POST /v1/users creates the account but does NOT log you in (no tokens) —
    // follow it with a login call, reusing the same credentials, to obtain the
    // token pair before saving the session.
    const user = await backendSignup(name, email, password)
    const tokens = await backendLogin(email, password)
    const session = await getSession()
    session.user = { id: user.id, email: user.email, name: user.name }
    session.tokens = tokens
    await session.save()
    return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 })
  } catch (err) {
    if (err instanceof BackendError) {
      // Map the two expected sign-up failures to clean client errors; never
      // forward the raw backend body.
      if (err.status === 409) {
        return NextResponse.json({ error: { code: 'users.email_taken', message: 'That email is already registered' } }, { status: 409 })
      }
      if (err.status === 422) {
        return NextResponse.json({ error: { code: 'validation_failed', message: 'Invalid sign-up details' } }, { status: 422 })
      }
      const status = err.status >= 400 && err.status < 500 ? err.status : 502
      return NextResponse.json({ error: { code: err.code, message: 'Sign up failed' } }, { status })
    }
    return NextResponse.json({ error: { code: 'internal_error', message: 'Sign up failed, try again' } }, { status: 502 })
  }
}
