import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

// Migrations are applied MANUALLY (pnpm db:migrate), never at server startup —
// auto-running them on boot races concurrently-starting instances and turns a
// schema change into an implicit side effect of a restart.
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false })
const db = drizzle(sql)

await migrate(db, { migrationsFolder: './drizzle' })
await sql.end()

console.log('migrations applied')
