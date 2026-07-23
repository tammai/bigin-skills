import { sql } from 'drizzle-orm'
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import { db } from '../../db/client.js'
import { eventBus } from '../../event-bus/bus.js'
import type { DomainEvent } from '../../event-bus/types.js'
import { deadLetterEvents } from '../dead-letter.schema.js'
// The two module outbox tables — imported via each module's narrow outbox.ts
// (the one cross-module import the boundary lint allows for shared/job-queue).
import { outboxEvents as usersOutbox } from '../../../modules/users/outbox.js'
import { outboxEvents as postsOutbox } from '../../../modules/posts/outbox.js'

const MAX_ATTEMPTS = 3
const BATCH = 20
// Backoff schedule indexed by (attempts - 1), for attempts BEFORE the final
// (dead-lettering) one — e.g. attempt 1 fails -> wait 1 min; attempt 2 fails
// -> wait 5 min; attempt 3 fails -> dead-letter (no further wait).
const BACKOFF_SECONDS = [60, 300]

// Registered module outboxes the relay polls. Adding a module = add its outbox
// here (the boundary lint permits exactly this import).
const OUTBOXES: PgTable[] = [usersOutbox, postsOutbox]

interface OutboxRow {
  id: string
  event_type: string
  schema_version: number
  payload: unknown
  occurred_at: Date
  attempts: number
}

// Polls each registered outbox with FOR UPDATE SKIP LOCKED (safe across
// rolling-deploy overlap — two relay ticks never grab the same row), publishes
// to the in-process event bus, and marks published_at. On handler failure it
// backs off (BACKOFF_SECONDS) before the next attempt, then dead-letters into
// the shared dead_letter_events table after MAX_ATTEMPTS — rows are never
// silently dropped, and the DLQ table stays queryable for manual inspection
// even after the source outbox row stops being polled.
export async function runOutboxRelay(): Promise<void> {
  // The registered outboxes are independent tables with no shared rows/locks
  // between them (each relayTable runs in its own transaction, already safe
  // across overlapping relay ticks via FOR UPDATE SKIP LOCKED) — relay them
  // concurrently rather than paying each table's latency in series.
  await Promise.all(OUTBOXES.map((table) => relayTable(table)))
}

async function relayTable(table: PgTable): Promise<void> {
  const cfg = getTableConfig(table)
  const qualified = `"${cfg.schema ?? 'public'}"."${cfg.name}"`
  const sourceTable = `${cfg.schema ?? 'public'}.${cfg.name}`

  await db.transaction(async (tx) => {
    const rows = (await tx.execute(sql`
      SELECT id, event_type, schema_version, payload, occurred_at, attempts
      FROM ${sql.raw(qualified)}
      WHERE published_at IS NULL
        AND dead_lettered_at IS NULL
        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      ORDER BY occurred_at ASC
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    `)) as unknown as OutboxRow[]

    for (const row of rows) {
      const event: DomainEvent = {
        id: row.id,
        type: row.event_type,
        schemaVersion: row.schema_version,
        payload: row.payload,
        occurredAt: row.occurred_at
      }
      try {
        await eventBus.publish(event)
        await tx.execute(sql`UPDATE ${sql.raw(qualified)} SET published_at = now() WHERE id = ${row.id}`)
      } catch (err) {
        const attempts = row.attempts + 1
        const message = err instanceof Error ? err.message : String(err)

        if (attempts >= MAX_ATTEMPTS) {
          await tx.execute(sql`
            UPDATE ${sql.raw(qualified)}
            SET attempts = ${attempts}, last_error = ${message}, dead_lettered_at = now()
            WHERE id = ${row.id}
          `)
          await tx.insert(deadLetterEvents).values({
            sourceTable,
            originalEventId: row.id,
            eventType: row.event_type,
            schemaVersion: row.schema_version,
            payload: row.payload,
            attempts,
            lastError: message,
            occurredAt: row.occurred_at
          })
        } else {
          const delaySeconds = BACKOFF_SECONDS[attempts - 1] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]
          await tx.execute(sql`
            UPDATE ${sql.raw(qualified)}
            SET attempts = ${attempts},
                last_error = ${message},
                next_attempt_at = now() + interval '1 second' * ${delaySeconds}
            WHERE id = ${row.id}
          `)
        }
      }
    }
  })
}
