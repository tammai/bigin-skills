import { defineConfig } from 'vitest/config'

// Separate config, separate `pnpm test:integration` script — deliberately not
// merged into vitest.config.ts's default `pnpm test` run (see the comment
// there). Requires Docker: globalSetup spins up a real Postgres via
// testcontainers (ADR §11: "real DB via test containers, not mocks"), applies
// the committed drizzle/*.sql migrations, then tears the container down.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globalSetup: ['./tests/global-setup.ts'],
    // Container pull/start + migrations can comfortably exceed vitest's 10s
    // default hook timeout on a cold Docker image cache.
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      JWT_SECRET: 'integration-test-secret'
    }
  }
})
