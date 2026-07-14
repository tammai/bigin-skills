import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { env } from '../config/env.js'
import * as schema from './schema.js'

// prepare: false — required for compatibility with PgBouncer in transaction-
// pooling mode; postgres.js's prepared statements don't survive across
// pooled connections there. Harmless against a direct Postgres connection
// (this scaffold's docker-compose ships direct Postgres, not PgBouncer).
const queryClient = postgres(env.DATABASE_URL, { prepare: false })

export const db = drizzle(queryClient, { schema })

// postgres() doesn't eagerly connect — the client is usable (and the
// process starts cleanly) even against an unreachable database; only a
// real query (see routes/health.ts's /readyz) surfaces connectivity
// failures.
export async function checkConnection(): Promise<boolean> {
  try {
    await queryClient`select 1`
    return true
  } catch {
    return false
  }
}
