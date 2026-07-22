import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // dist/ holds the compiled output of the very same *.test.ts files —
    // without this exclude, `pnpm build` then `pnpm test` runs every test
    // twice (once as source, once as compiled JS). *.integration.test.ts
    // needs a real Postgres (via testcontainers — see
    // vitest.integration.config.ts) and is deliberately NOT part of the
    // default `pnpm test` run, so the scaffold's own verification (and any
    // dev inner loop) never depends on Docker being available.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    env: {
      // Lets tests import src/api/app.ts (which eagerly validates env at module
      // load) without a real .env file or a live Postgres — no test here ever
      // executes a real query against these values.
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      JWT_SECRET: 'test-secret-not-for-production'
    }
  }
})
