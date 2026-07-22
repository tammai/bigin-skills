import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../../shared/db/client.js'
import { refreshTokens } from './users.schema.js'

type Row = typeof refreshTokens.$inferSelect

export interface CreateRefreshTokenRow {
  userId: string
  tokenHash: string
  familyId: string
  expiresAt: Date
}

export const refreshTokenRepository = {
  async create(input: CreateRefreshTokenRow): Promise<Row> {
    const [row] = await db.insert(refreshTokens).values(input).returning()
    return row
  },

  async findByHash(tokenHash: string): Promise<Row | undefined> {
    const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash))
    return row
  },

  async revoke(id: string, replacedById: string | null): Promise<void> {
    await db.update(refreshTokens).set({ revokedAt: new Date(), replacedById }).where(eq(refreshTokens.id, id))
  },

  // Reuse of an already-revoked token in a family is a theft signal — nuke the
  // whole lineage.
  async revokeFamily(familyId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
  }
}
