import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { env } from '../config/env.js'

// prepare: false — required for PgBouncer transaction-pooling compatibility;
// postgres.js's prepared statements don't survive across pooled connections
// there. Harmless against direct Postgres (this scaffold's docker-compose).
export const queryClient = postgres(env.DATABASE_URL, { prepare: false })

// No schema passed: repositories use the query builder against per-module table
// objects directly, and the cursor list() path uses `queryClient.unsafe` with
// the spike-verified keyset generator. There is no relational-query `db.query.*`
// usage that would need the schema registered here.
export const db = drizzle(queryClient)

// postgres() doesn't eagerly connect — the client is usable (and the process
// starts cleanly) even against an unreachable database; only a real query (see
// /readyz) surfaces connectivity failures. Never sprinkle this check elsewhere.
export async function checkConnection(): Promise<boolean> {
  try {
    await queryClient`select 1`
    return true
  } catch {
    return false
  }
}
