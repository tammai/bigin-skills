import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // `drizzle-kit generate` diffs schema.ts against drizzle/'s existing
    // snapshots — it never connects to this URL, so a placeholder is fine
    // when DATABASE_URL isn't set yet (e.g. before the first `cp .env.example .env`).
    url: process.env.DATABASE_URL ?? 'postgres://placeholder:placeholder@localhost:5432/placeholder'
  }
})
