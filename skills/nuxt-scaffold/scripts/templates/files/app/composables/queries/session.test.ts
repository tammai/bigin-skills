import { describe, it, expect } from 'vitest'
import { useMe } from './session'

describe('useMe', () => {
  it('starts fetching immediately', () => {
    const { status } = useMe()
    // Pinia Colada has no 'idle' status — useQuery fires eagerly, so a fresh query is 'pending'.
    expect(status.value).toBe('pending')
  })
})
