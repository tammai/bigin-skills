import { describe, it, expect } from 'vitest'
import { useSessionStore } from './session'

describe('useSessionStore', () => {
  it('starts fetching immediately', () => {
    const store = useSessionStore()
    // Pinia Colada has no 'idle' status — useQuery fires eagerly, so a fresh store is 'pending'.
    expect(store.status).toBe('pending')
  })
})
