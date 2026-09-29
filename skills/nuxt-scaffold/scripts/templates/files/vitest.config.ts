import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['tests/**/*.test.ts'],
    // Vitest's default is one fork per core, each booting a Nuxt environment — at 12 that
    // pegged a machine at load 25-48 and finished later. See .claude/rules/testing.md.
    maxWorkers: 4
  }
})
