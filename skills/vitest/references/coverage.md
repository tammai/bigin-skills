# Vitest Coverage Setup

## Provider: V8 (recommended)

V8 is built into Node.js — no additional instrumentation needed, fast and accurate.

```bash
pnpm add -D @vitest/coverage-v8
```

---

## Config in vitest.config.ts

```ts
export default defineVitestConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],  // text = terminal, html = browser report
      reportsDirectory: 'coverage',
      include: [
        'app/**/*.{ts,vue}',        // pages, components, composables, stores
        'server/**/*.ts',            // Nitro API routes (Fullstack MVP only)
      ],
      exclude: [
        '**/*.d.ts',
        'app/plugins/**',
        'app/app.vue',               // root app shell, not meaningful to test
        'server/plugins/**',
        '**/*.config.ts',
      ],
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

## Running coverage

```bash
pnpm vitest run --coverage        # full run with report
pnpm vitest run --coverage --reporter=verbose  # more detail per file
```

Report is written to `coverage/index.html` — open in browser for line-by-line view.

---

## Per-file coverage thresholds (optional)

For critical files, add inline comments to enforce higher thresholds:

```ts
// app/stores/auth.ts
/* v8 ignore next */   // exclude a single line from coverage
```

Or in config:
```ts
thresholds: {
  'app/stores/auth.ts': { lines: 90, functions: 90 },
}
```

---

## CI integration

```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: pnpm vitest run --coverage

- name: Upload coverage report
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage/
```

To fail CI on coverage drop, ensure `thresholds` are set — Vitest will exit with code 1 if thresholds aren't met.
