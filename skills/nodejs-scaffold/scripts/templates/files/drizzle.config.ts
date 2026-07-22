import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  // Glob across every module's infrastructure schema plus the shared schemas
  // (idempotency, etc.). One migration history spans all modules — a known,
  // accepted limitation of a fixed two-module scaffold (module A's and module
  // B's schema changes land in the same generated migration if changed
  // together); it is NOT a per-module-independent-deploy story.
  schema: ['./src/modules/*/infrastructure/*.schema.ts', './src/shared/**/*.schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // `drizzle-kit generate` diffs the schema files against drizzle/'s existing
    // snapshots — it never connects to this URL, so a placeholder is fine when
    // DATABASE_URL isn't set yet (e.g. before the first `cp .env.example .env`).
    url: process.env.DATABASE_URL ?? 'postgres://placeholder:placeholder@localhost:5432/placeholder'
  }
})
