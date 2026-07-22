import { describe, it, expect } from 'vitest'
import { generateRefreshToken, hashRefreshToken, durationToSeconds } from './tokens.js'

describe('tokens', () => {
  it('generates a sufficiently long, unique random token each call', () => {
    const a = generateRefreshToken()
    const b = generateRefreshToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(30)
  })

  it('hashes deterministically (same input -> same hash, different input -> different hash)', () => {
    expect(hashRefreshToken('x')).toBe(hashRefreshToken('x'))
    expect(hashRefreshToken('x')).not.toBe(hashRefreshToken('y'))
  })

  describe('durationToSeconds', () => {
    it.each([
      ['15m', 900],
      ['1h', 3600],
      ['1d', 86400],
      ['30s', 30],
      ['3600', 3600]
    ])('parses %s to %d seconds', (input, expected) => {
      expect(durationToSeconds(input)).toBe(expected)
    })
  })
})
