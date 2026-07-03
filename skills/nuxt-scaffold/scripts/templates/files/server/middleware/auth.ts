export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event)
  if (pathname.startsWith('/api/') && pathname !== '/api/login') {
    await requireUserSession(event)
  }
})
