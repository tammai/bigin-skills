import { defineQueryOptions } from '@pinia/colada'

export const userQueries = {
  list: defineQueryOptions({
    key: ['users', 'list'],
    query: () => $fetch('/api/users'),
  }),
}
