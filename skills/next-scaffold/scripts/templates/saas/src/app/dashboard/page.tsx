'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AuthGate } from '@/features/users/components/auth-gate'
import { useProfile } from '@/features/users/hooks/use-profile'
import { useLogout } from '@/features/users/hooks/use-session'

function Dashboard() {
  const router = useRouter()
  const { data: user } = useProfile()
  const logout = useLogout()

  async function onLogout() {
    await logout.mutateAsync().catch(() => {})
    router.replace('/login')
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold">{PROJECT_NAME}</span>
        <Button variant="ghost" onClick={onLogout} disabled={logout.isPending}>Sign out</Button>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Signed in as {user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is a private area — AuthGate sends a visitor to /login when
              GET /api/v1/user/profile answers 401. The app holds no token: the API sets an
              HttpOnly session cookie and the /api/v1/** pass-through (next.config.ts) forwards it.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  )
}
