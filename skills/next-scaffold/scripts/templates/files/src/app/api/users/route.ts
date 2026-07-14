import { NextResponse } from 'next/server'

export async function GET() {
  const backendUrl = process.env.BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json({ error: 'BACKEND_URL is not configured' }, { status: 500 })
  }
  try {
    const res = await fetch(`${backendUrl}/users`)
    if (!res.ok) throw new Error('backend error')
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 })
  }
}
