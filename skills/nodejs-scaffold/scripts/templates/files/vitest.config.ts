import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // dist/ holds the compiled output of the very same *.test.ts files —
    // without this exclude, `pnpm build` then `pnpm test` runs every test
    // twice (once as source, once as compiled JS).
    exclude: ['**/node_modules/**', '**/dist/**'],
    env: {
      // Lets route/handler tests import src/app.ts (which eagerly validates
      // env at module load) without requiring a real .env file or a live
      // Postgres — no test here ever executes a real query against this URL.
      DATABASE_URL: 'postgres://test:test@localhost:5432/test'
    }
  }
})
