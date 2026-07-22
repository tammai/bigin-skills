import { describe, it, expect } from 'vitest'
import { encodeCursor, decodeCursor, parseSort, serializeSort, buildKeysetWhere, CursorMismatchError } from './cursor.js'

describe('cursor encode/decode', () => {
  it('round-trips values under the same sort', () => {
    const c = encodeCursor('-created_at,name', ['2024-01-01T00:00:00.000Z', 'Ada', 'id-1'])
    expect(decodeCursor(c, '-created_at,name')).toEqual(['2024-01-01T00:00:00.000Z', 'Ada', 'id-1'])
  })

  it('throws CursorMismatchError when the sort changed mid-pagination', () => {
    const c = encodeCursor('-created_at', ['2024-01-01T00:00:00.000Z', 'id-1'])
    expect(() => decodeCursor(c, 'name')).toThrow(CursorMismatchError)
  })

  it('throws on a garbage cursor', () => {
    expect(() => decodeCursor('!!!not-base64-json!!!', '-created_at')).toThrow(CursorMismatchError)
  })
})

describe('parseSort', () => {
  it('parses direction prefixes against the allowlist', () => {
    expect(parseSort('-created_at,name', ['created_at', 'name'], '-created_at')).toEqual([
      { column: 'created_at', direction: 'desc' },
      { column: 'name', direction: 'asc' }
    ])
  })

  it('falls back when no sort is given', () => {
    expect(serializeSort(parseSort(undefined, ['created_at'], '-created_at'))).toBe('-created_at')
  })

  it('rejects a column not on the allowlist', () => {
    expect(() => parseSort('password_hash', ['created_at', 'name'], '-created_at')).toThrow()
  })
})

describe('buildKeysetWhere', () => {
  it('expands a single desc column plus the id tiebreaker into an OR-chain', () => {
    const { sql, params } = buildKeysetWhere([{ column: 'created_at', direction: 'desc' }], ['2024-01-01', 'id-1'])
    expect(sql).toBe('(created_at < $1)\n  OR (created_at = $2 AND id > $3)')
    expect(params).toEqual(['2024-01-01', '2024-01-01', 'id-1'])
  })

  it('respects each column direction in a mixed sort', () => {
    const { sql } = buildKeysetWhere(
      [
        { column: 'created_at', direction: 'desc' },
        { column: 'name', direction: 'asc' }
      ],
      ['2024-01-01', 'Ada', 'id-1']
    )
    // desc uses <, asc uses >
    expect(sql).toContain('created_at < $1')
    expect(sql).toContain('created_at = $2 AND name > $3')
    expect(sql).toContain('created_at = $4 AND name = $5 AND id > $6')
  })
})
