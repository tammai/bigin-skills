import { describe, it, expect } from 'vitest'
import { useUsers } from '~~/app/composables/queries/users'

describe('useUsers', () => {
  it('starts fetching immediately', () => {
    const { status } = useUsers()
    // Pinia Colada has no 'idle' status — useQuery fires eagerly, so a fresh query is 'pending'.
    expect(status.value).toBe('pending')
  })
})
