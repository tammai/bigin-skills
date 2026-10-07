// Only /dashboard/** is private; the marketing site stays public and makes no API call.
// The redirect rules live in app/utils/auth-redirect.ts.
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth()
  const target = await authRedirect(to.path, user.value, fetchUser)
  if (target) return navigateTo(target)
})
