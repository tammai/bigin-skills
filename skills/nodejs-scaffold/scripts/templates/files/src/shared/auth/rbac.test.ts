import { describe, it, expect } from 'vitest'
import { can } from './rbac.js'

describe('rbac', () => {
  it('grants a permission the role has', () => {
    expect(can(['user'], 'posts:write')).toBe(true)
  })

  it('denies a permission the role lacks', () => {
    expect(can(['user'], 'users:erase')).toBe(false)
  })

  it('grants admin the erase permission', () => {
    expect(can(['admin'], 'users:erase')).toBe(true)
  })

  it('ignores unknown roles', () => {
    expect(can(['superuser'], 'posts:write')).toBe(false)
  })
})
