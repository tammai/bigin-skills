'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/shared/api-client/errors'
import { useProfile } from '../hooks/use-profile'

// Client-side route protection. The session is an HttpOnly cookie the browser cannot inspect,
// so "signed in" is whatever GET /api/v1/user/profile says: a 401 sends the visitor to /login,
// anything else that fails (API down, 5xx) shows a retry instead of pretending they signed out.
// This is UX, not security — the API enforces the session on every call, and with no SSR there
// is nothing server-side to protect.
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { data, error, refetch } = useProfile()
  const signedOut = isApiError(error, 401)

  useEffect(() => {
    if (signedOut) router.replace('/login')
  }, [signedOut, router])

  if (signedOut) return null
  if (data) return <>{children}</>
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-sm text-muted-foreground">Could not reach the API.</p>
        <Button variant="outline" onClick={() => refetch()}>Try again</Button>
      </div>
    )
  }
  return null
}
