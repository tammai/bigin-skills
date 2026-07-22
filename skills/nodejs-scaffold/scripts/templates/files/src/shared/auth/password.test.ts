import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'

describe('password (argon2id)', () => {
  it('round-trips a correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword(hash, 'correct-horse-battery-staple')).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword(hash, 'wrong')).toBe(false)
  })

  it('never stores the password in plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(hash).not.toContain('correct-horse-battery-staple')
  })
})
