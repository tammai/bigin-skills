import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { eq, lt } from 'drizzle-orm'
import { db } from '../db/client.js'
import { env } from '../config/env.js'
import { AppError } from '../errors/app-error.js'
import { ErrorCode } from '../errors/codes.js'
import { idempotencyKeys } from './idempotency.schema.js'

declare module 'fastify' {
  interface FastifyContextConfig {
    idempotent?: boolean
  }
  interface FastifyRequest {
    idempotencyKey?: string
  }
}

function hashRequest(request: FastifyRequest): string {
  const raw = JSON.stringify({ method: request.method, url: request.url, body: request.body ?? null })
  return createHash('sha256').update(raw).digest('hex')
}

function parseBody(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload
  try {
    return JSON.parse(payload)
  } catch {
    return payload
  }
}

// Opt-in per route via `config: { idempotent: true }` (GET/DELETE don't need
// it, so this is not a global mutation hook). The lock is an INSERT-first
// (onConflictDoNothing) — a plain lookup-then-store leaves a TOCTOU race a
// concurrent duplicate could exploit.
export function idempotencyPlugin(app: FastifyInstance): void {
  app.decorateRequest('idempotencyKey', undefined)

  app.addHook('preHandler', async (request, reply) => {
    if (!request.routeOptions.config.idempotent) return

    const header = request.headers['idempotency-key']
    const key = typeof header === 'string' ? header : Array.isArray(header) ? header[0] : undefined
    if (!key) {
      throw new AppError(400, ErrorCode.IdempotencyKeyRequired, 'Idempotency-Key header is required')
    }

    const requestHash = hashRequest(request)
    const expiresAt = new Date(Date.now() + env.IDEMPOTENCY_KEY_TTL_HOURS * 3600_000)

    // Insert-first is the lock: exactly one concurrent request wins the row.
    const inserted = await db
      .insert(idempotencyKeys)
      .values({ key, requestHash, expiresAt })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key })

    if (inserted.length > 0) {
      request.idempotencyKey = key
      return
    }

    // Someone already holds this key.
    const [existing] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key))
    if (!existing) return // vanishingly-rare race (row expired+cleaned between insert and select) — let it proceed

    if (existing.requestHash !== requestHash) {
      throw new AppError(422, ErrorCode.IdempotencyKeyReused, 'Idempotency-Key was already used for a different request')
    }
    if (existing.statusCode == null) {
      // still in-flight — a scaffold returns 409 rather than poll-and-wait; a
      // money-adjacent deployment might prefer to block for the result.
      throw new AppError(409, ErrorCode.RequestInProgress, 'a request with this Idempotency-Key is still in progress')
    }

    // Replay the stored response byte-for-byte.
    reply.header('idempotent-replayed', 'true')
    await reply.code(existing.statusCode).send(existing.responseBody)
  })

  app.addHook('onSend', async (request, reply, payload) => {
    const key = request.idempotencyKey
    if (!key) return payload

    if (reply.statusCode >= 500) {
      // Never cache a 5xx as a valid replay target — release the lock so the
      // client can retry.
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key))
      return payload
    }

    await db
      .update(idempotencyKeys)
      .set({ statusCode: reply.statusCode, responseBody: parseBody(payload) })
      .where(eq(idempotencyKeys.key, key))
    return payload
  })
}

// Registered as the job queue's second recurring task (hourly). Deletes expired
// keys so the store doesn't grow unbounded.
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const deleted = await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt, new Date()))
    .returning({ key: idempotencyKeys.key })
  return deleted.length
}
