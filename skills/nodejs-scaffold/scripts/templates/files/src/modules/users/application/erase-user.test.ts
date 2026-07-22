import { describe, it, expect, vi, beforeEach } from 'vitest'

// erase-user.ts drives the DB transaction directly (no repository abstraction
// — it must guarantee the delete + outbox insert land in ONE transaction), so
// the fake here mimics Drizzle's chainable builder rather than a repository
// method. vi.hoisted is required: vi.mock's factory runs before the rest of
// this file, so anything it references (the fakes) must be defined via
// vi.hoisted, not as plain module-scope const.
const { txMock, transactionMock } = vi.hoisted(() => {
  const txMock = {
    delete: vi.fn(),
    insert: vi.fn(),
    where: vi.fn(),
    values: vi.fn(),
    returning: vi.fn()
  }
  txMock.delete.mockReturnValue(txMock)
  txMock.where.mockReturnValue(txMock)
  txMock.insert.mockReturnValue(txMock)
  const transactionMock = vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock))
  return { txMock, transactionMock }
})

vi.mock('../../../shared/db/client.js', () => ({ db: { transaction: transactionMock } }))
vi.mock('../../../shared/auth/rbac.js', () => ({ can: vi.fn() }))

const { can } = await import('../../../shared/auth/rbac.js')
const { eraseUser } = await import('./erase-user.js')

describe('eraseUser', () => {
  beforeEach(() => {
    // mockClear (not mockReset) on the chainable methods — clears call
    // history but keeps their mockReturnValue(txMock) chaining intact.
    txMock.delete.mockClear()
    txMock.insert.mockClear()
    txMock.where.mockClear()
    txMock.returning.mockReset()
    txMock.values.mockReset()
    vi.mocked(can).mockReset()
  })

  it('allows a user to erase themselves without needing users:erase', async () => {
    txMock.returning.mockResolvedValueOnce([{ id: 'u1' }])

    await eraseUser('u1', { sub: 'u1', roles: ['user'] })

    expect(can).not.toHaveBeenCalled()
    expect(txMock.values).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'user.erased', payload: { userId: 'u1' } })
    )
  })

  it('rejects erasing someone else without users:erase', async () => {
    vi.mocked(can).mockReturnValue(false)

    await expect(eraseUser('u2', { sub: 'u1', roles: ['user'] })).rejects.toMatchObject({ statusCode: 403 })
    expect(txMock.delete).not.toHaveBeenCalled()
  })

  it('allows an admin with users:erase to erase someone else', async () => {
    vi.mocked(can).mockReturnValue(true)
    txMock.returning.mockResolvedValueOnce([{ id: 'u2' }])

    await eraseUser('u2', { sub: 'admin1', roles: ['admin'] })

    expect(txMock.delete).toHaveBeenCalled()
  })

  it('throws not_found when the user row does not exist', async () => {
    txMock.returning.mockResolvedValueOnce([])

    await expect(eraseUser('missing', { sub: 'missing', roles: ['user'] })).rejects.toMatchObject({ statusCode: 404 })
    expect(txMock.insert).not.toHaveBeenCalled()
  })
})
