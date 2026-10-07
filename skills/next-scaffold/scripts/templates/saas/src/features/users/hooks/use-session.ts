import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/shared/api-client'
import { ApiError } from '@/shared/api-client/errors'
import { userQueries, useProfile, type User } from './use-profile'

// Browser sessions against go-scaffold's cookie-session endpoints, reached through the /api/v1
// pass-through. The API sets and clears the HttpOnly session cookie itself; this code never
// sees a token. Mutations must come from an origin listed in the API's WEB_ORIGINS, or the
// API answers 403.

export type Credentials = { email: string, password: string }
export type SignupInput = Credentials & { full_name: string }

// POST /api/v1/auth/session — 201 { user } + Set-Cookie, 401 on bad credentials.
async function createSession(credentials: Credentials): Promise<User> {
  const { data, response } = await apiClient.POST('/auth/session', { body: credentials })
  if (!data) throw new ApiError(response.status)
  return data.user
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSession,
    onSuccess: user => queryClient.setQueryData(userQueries.profile.queryKey, user)
  })
}

// POST /api/v1/auth/signup — 201, or 409 when the email is taken. It does not sign you in,
// so sign-up is followed by the login call.
export function useSignup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ full_name, email, password }: SignupInput): Promise<User> => {
      const { response } = await apiClient.POST('/auth/signup', { body: { full_name, email, password } })
      if (!response.ok) throw new ApiError(response.status)
      return createSession({ email, password })
    },
    onSuccess: user => queryClient.setQueryData(userQueries.profile.queryKey, user)
  })
}

// DELETE /api/v1/auth/session — drops the session server-side and clears the cookie. The cached
// profile goes either way: a failed sign-out must not leave the UI looking signed in.
export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { response } = await apiClient.DELETE('/auth/session')
      if (!response.ok) throw new ApiError(response.status)
    },
    onSettled: () => queryClient.removeQueries({ queryKey: userQueries.profile.queryKey })
  })
}

// Login and signup send a visitor who already has a session straight to the dashboard.
// "Signed in" is whatever GET /api/v1/user/profile says — the cookie is HttpOnly.
export function useRedirectIfSignedIn(to = '/dashboard') {
  const router = useRouter()
  const { data } = useProfile()
  useEffect(() => {
    if (data) router.replace(to)
  }, [data, router, to])
}
