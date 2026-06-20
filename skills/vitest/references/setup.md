# Vitest Setup for Nuxt v4

## Install

```bash
pnpm add -D vitest @vue/test-utils @nuxt/test-utils happy-dom @vitest/coverage-v8
```

> `happy-dom` is the recommended environment (lighter than jsdom, faster startup).

---

## vitest.config.ts

Place at project root alongside `nuxt.config.ts`:

```ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',          // uses @nuxt/test-utils Nuxt environment
    environmentOptions: {
      nuxt: {
        rootDir: '.',
      },
    },
    globals: true,                // no need to import describe/it/expect
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
      exclude: ['**/*.d.ts', 'app/plugins/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
})
```

---

## package.json scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## tsconfig adjustment

Ensure `vitest/globals` types are included if you use `globals: true`:

```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

---

## Notes

- **Don't** use `@vitejs/plugin-vue` manually — `@nuxt/test-utils` handles it via the `nuxt` environment.
- For **non-Nuxt** unit tests (pure composables, utils) you can set `environment: 'happy-dom'` per-file:
  ```ts
  // @vitest-environment happy-dom
  import { describe, it } from 'vitest'
  ```
- Tests run against the compiled Nuxt build context, so auto-imports (components, composables) work without manual imports in test files.
