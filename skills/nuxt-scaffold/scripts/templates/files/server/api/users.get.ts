export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  const backendUrl = useRuntimeConfig().backendUrl
  if (!backendUrl) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_BACKEND_URL is not configured' })
  }
  try {
    return await $fetch(`${backendUrl}/users`, {
      headers: { Authorization: `Bearer ${secure.token}` }
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Backend unreachable' })
  }
})
