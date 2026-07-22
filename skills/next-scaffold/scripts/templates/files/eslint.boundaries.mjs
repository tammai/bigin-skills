import boundaries from 'eslint-plugin-boundaries'

// ── Feature-folder boundary enforcement (eslint-plugin-boundaries@7) ──────
// The src/ shape (features/<feature>, shared, lib, app) is only a REAL boundary
// because this rule fails `pnpm lint` on an illegal import. Next.js enforces
// nothing here — delete this and the architecture is just naming.
//
// IMPORTANT (spike-confirmed false-negative trap, same as the backend's config):
// `import/resolver.typescript` is load-bearing, not optional. Without
// eslint-import-resolver-typescript installed and configured, the `@/*` alias
// resolves to an *unknown* element, and unknown targets are silently PERMITTED —
// so real violations pass lint with no error. If a deliberately-broken
// cross-feature import ever passes `pnpm lint`, check this resolver first.
//
// Exported as a flat-config object and spread into eslint.config.mjs by the
// scaffold. Tests are exempt (mocking legitimately crosses lines). Uses the v7
// `policies` key (v7 renamed `rules` → `policies`); the object element form and
// `{{from.captured.*}}` templating mirror the backend's proven config.
export const boundariesConfig = {
  files: ['src/**/*.{ts,tsx}'],
  ignores: ['**/*.test.ts', '**/*.test.tsx'],
  settings: {
    'import/resolver': { typescript: true },
    'boundaries/elements': [
      { type: 'feature', pattern: 'src/features/(*)/**', capture: ['feature'] },
      { type: 'shared', pattern: 'src/shared/**' },
      { type: 'lib', pattern: 'src/lib/**' },
      { type: 'app', pattern: 'src/app/**' }
    ]
  },
  plugins: { boundaries },
  rules: {
    'boundaries/dependencies': [
      2,
      {
        default: 'disallow',
        // Unclassified paths (e.g. src/components/ui/**, src/hooks/** from the
        // shadcn dashboard block) are neither restricted as importers nor as
        // import targets — only classified→classified edges are governed.
        policies: [
          // A feature may import ONLY its own tree, plus shared + lib. Never
          // another feature — that cross-feature coupling is what this blocks.
          {
            from: { element: { type: 'feature' } },
            allow: [
              { element: { type: 'feature', captured: { feature: '{{from.captured.feature}}' } } },
              { element: { type: ['shared', 'lib'] } }
            ]
          },
          // shared: the reusable kernel. May lean on lib + other shared only.
          { from: { element: { type: 'shared' } }, allow: [{ element: { type: ['shared', 'lib'] } }] },
          // lib: low-level server helpers (session, backend client). lib + shared.
          { from: { element: { type: 'lib' } }, allow: [{ element: { type: ['lib', 'shared'] } }] },
          // app (routes + pages): the composition layer. May pull in any
          // feature, plus shared/lib and sibling app files.
          { from: { element: { type: 'app' } }, allow: [{ element: { type: ['app', 'feature', 'shared', 'lib'] } }] }
        ]
      }
    ]
  }
}
