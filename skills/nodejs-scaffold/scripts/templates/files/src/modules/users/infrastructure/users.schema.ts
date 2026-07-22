import { pgSchema, uuid, text, timestamp, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

// One Postgres schema per module — a real namespace, not just a TS file split.
// `information_schema` shows the boundary; there are no cross-schema FKs.
export const usersSchema = pgSchema('users')

// Audit + soft-delete columns are on every table by convention.
export const users = usersSchema.table(
  'users',
  {
    // UUIDv7 (time-ordered) via uuid@11's v7() — NOT defaultRandom()
    // (gen_random_uuid = v4) and NOT crypto.randomUUID() (also v4).
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    roles: jsonb('roles').$type<string[]>().notNull().default(sql`'["user"]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'), // bare uuid, never a cross-schema FK
    updatedBy: uuid('updated_by'),
    version: integer('version').notNull().default(1), // optimistic concurrency
    deletedAt: timestamp('deleted_at', { withTimezone: true })
  },
  (t) => [
    // Soft delete turns unique constraints into partial unique indexes.
    uniqueIndex('users_email_active_uq').on(t.email).where(sql`${t.deletedAt} is null`)
  ]
)

// Refresh-token rotation lineage. token_hash is sha256 (a refresh token is a
// 256-bit random value — nothing to brute-force; a slow hash only adds latency).
export const refreshTokens = usersSchema.table(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    userId: uuid('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    familyId: uuid('family_id').notNull(), // reusing a revoked token in the same family = theft signal → revoke family
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('refresh_tokens_hash_idx').on(t.tokenHash), index('refresh_tokens_user_idx').on(t.userId)]
)

// Transactional outbox. Defined here (co-located with the module's other tables
// so drizzle-kit's schema glob needs no special-casing) and re-exported from
// the module-root outbox.ts — the one narrow file shared/job-queue may import.
export const outboxEvents = usersSchema.table(
  'outbox_events',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    eventType: text('event_type').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }), // null = unsent
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    // null = eligible now; set to a future time on a retryable failure so the
    // relay backs off instead of hammering a still-failing handler every tick.
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    deadLetteredAt: timestamp('dead_lettered_at', { withTimezone: true })
  },
  (t) => [index('users_outbox_unpublished_idx').on(t.publishedAt)]
)
