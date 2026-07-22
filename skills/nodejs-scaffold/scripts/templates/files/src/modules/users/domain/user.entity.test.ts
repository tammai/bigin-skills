import { describe, it, expect } from 'vitest'
import { toUserView, toPublicView } from './user.entity.js'

describe('user.entity', () => {
  const base = { id: 'u1', email: 'a@example.com', name: 'Ada', createdAt: new Date('2024-01-01T00:00:00.000Z') }

  it('toUserView projects the public-facing fields', () => {
    expect(toUserView(base)).toEqual({ id: 'u1', email: 'a@example.com', name: 'Ada', createdAt: base.createdAt })
  })

  it('toPublicView narrows to id + name only, dropping email', () => {
    const view = toPublicView(base)
    expect(view).toEqual({ id: 'u1', name: 'Ada' })
    expect(view).not.toHaveProperty('email')
  })
})
