import { execSync } from 'node:child_process'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'

// Vitest global setup: runs ONCE before any integration test file, in the
// main process — setting process.env here is what makes DATABASE_URL visible
// to the worker processes vitest forks afterward for the actual test files.
let container: StartedPostgreSqlContainer | undefined

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const url = container.getConnectionUri()
  process.env.DATABASE_URL = url

  // Apply the committed drizzle/*.sql migrations to the fresh container —
  // the same script `pnpm db:migrate` runs against a real deploy, so
  // integration tests exercise the actual migration history, not a
  // hand-rolled schema.
  execSync('pnpm db:migrate', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } })
}

export async function teardown(): Promise<void> {
  await container?.stop()
}
