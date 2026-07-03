import { useQuery } from '@pinia/colada'

export const useSessionStore = defineStore('session', () => {
  const { data: me, status, refresh } = useQuery({
    key: ['me'],
    query: () => $fetch('/api/me')
  })
  const isAuthenticated = computed(() => status.value === 'success' && me.value != null)
  return { me, status, refresh, isAuthenticated }
})
