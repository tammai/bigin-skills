import { describe, it, expect, beforeEach } from 'vitest'
import { eventBus } from './bus.js'

describe('eventBus', () => {
  beforeEach(() => {
    eventBus.reset()
  })

  it('delivers a published event to every subscriber of that type', async () => {
    const seen: string[] = []
    eventBus.subscribe('user.erased', async (e) => {
      seen.push(`a:${e.id}`)
    })
    eventBus.subscribe('user.erased', async (e) => {
      seen.push(`b:${e.id}`)
    })

    await eventBus.publish({ id: 'evt1', type: 'user.erased', schemaVersion: 1, payload: {}, occurredAt: new Date() })

    expect(seen.sort()).toEqual(['a:evt1', 'b:evt1'])
  })

  it('never calls a handler subscribed to a different event type', async () => {
    let called = false
    eventBus.subscribe('other.type', () => {
      called = true
    })

    await eventBus.publish({ id: 'evt1', type: 'user.erased', schemaVersion: 1, payload: {}, occurredAt: new Date() })

    expect(called).toBe(false)
  })

  it('propagates a handler error to the caller (so the relay can count the attempt)', async () => {
    eventBus.subscribe('user.erased', async () => {
      throw new Error('boom')
    })

    await expect(
      eventBus.publish({ id: 'evt1', type: 'user.erased', schemaVersion: 1, payload: {}, occurredAt: new Date() })
    ).rejects.toThrow('boom')
  })
})
