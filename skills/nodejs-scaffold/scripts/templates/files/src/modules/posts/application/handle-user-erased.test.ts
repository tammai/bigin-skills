import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DomainEvent } from '../../../shared/event-bus/types.js'

vi.mock('../infrastructure/posts.repository.js', () => ({
  postsRepository: { markProcessed: vi.fn(), anonymizeAuthor: vi.fn() }
}))

const { postsRepository } = await import('../infrastructure/posts.repository.js')
const { handleUserErased } = await import('./handle-user-erased.js')

function event(id: string, userId: string): DomainEvent {
  return { id, type: 'user.erased', schemaVersion: 1, payload: { userId }, occurredAt: new Date() }
}

describe('handleUserErased', () => {
  beforeEach(() => {
    vi.mocked(postsRepository.markProcessed).mockReset()
    vi.mocked(postsRepository.anonymizeAuthor).mockReset()
  })

  it('anonymizes the author on the first delivery', async () => {
    vi.mocked(postsRepository.markProcessed).mockResolvedValue(true)

    await handleUserErased(event('evt1', 'u1'))

    expect(postsRepository.anonymizeAuthor).toHaveBeenCalledWith('u1')
  })

  it('is a no-op on a redelivered (already-processed) event — inbox dedup', async () => {
    vi.mocked(postsRepository.markProcessed).mockResolvedValue(false)

    await handleUserErased(event('evt1', 'u1'))

    expect(postsRepository.anonymizeAuthor).not.toHaveBeenCalled()
  })
})
