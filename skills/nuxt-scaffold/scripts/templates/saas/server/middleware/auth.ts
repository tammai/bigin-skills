const PROTECTED_PREFIXES = ['/api/me', '/api/dashboard']

export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event)
  if (PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    await requireUserSession(event)
  }
})
