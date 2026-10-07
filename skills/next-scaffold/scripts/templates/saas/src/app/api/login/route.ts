import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { backendLogin } from '@/lib/backend'
import { loginErrorResponse } from '@/lib/auth-errors'

const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(8)
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = LoginBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'validation_failed', message: 'Invalid request body' } }, { status: 422 })
  }
  try {
    // The backend's login response carries the user alongside the token pair,
    // so the session holds the real profile — no JWT decoding needed.
    const { tokens, user } = await backendLogin(parsed.data.email, parsed.data.password)
    const session = await getSession()
    session.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
    session.tokens = tokens
    await session.save()
    return NextResponse.json(session.user)
  } catch (err) {
    return loginErrorResponse(err)
  }
}
