// Boots the app and dumps app.swagger() to src/api/openapi.json (code-first
// OpenAPI). NO database is touched — this is static route-schema introspection.
//
// The app's env.ts fail-closes on a missing DATABASE_URL/JWT_SECRET, so set
// placeholders BEFORE importing anything that transitively loads env.ts. In ESM
// static imports are hoisted and run first, so buildApp is imported dynamically
// AFTER these assignments — same fail-open pattern drizzle.config.ts uses.
process.env.DATABASE_URL ??= 'postgres://placeholder:placeholder@localhost:5432/placeholder'
process.env.JWT_SECRET ??= 'openapi-export-placeholder-secret'

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { buildApp } = await import('../src/api/app.js')

const app = await buildApp()
await app.ready()
const spec = app.swagger()
const out = fileURLToPath(new URL('../src/api/openapi.json', import.meta.url))
writeFileSync(out, JSON.stringify(spec, null, 2) + '\n')
await app.close()
console.log(`wrote ${out}`)
