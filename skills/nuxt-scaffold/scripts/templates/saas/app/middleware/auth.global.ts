export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (to.path.startsWith('/dashboard') && !loggedIn.value) {
    return navigateTo('/login')
  }
  if ((to.path === '/login' || to.path === '/signup') && loggedIn.value) {
    return navigateTo('/dashboard')
  }
})
