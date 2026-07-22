import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

// ── Module-boundary enforcement (eslint-plugin-boundaries@7) ──────────────
// The directory shape (src/modules/<mod>/{domain,application,infrastructure,api})
// is only a REAL boundary because this rule fails the build on an illegal
// cross-layer / cross-module import. Fastify plugin encapsulation enforces
// nothing here — remove this block and the architecture is decorative.
//
// IMPORTANT (spike-confirmed false-negative trap): `import/resolver.typescript`
// below is load-bearing, not optional. Without eslint-import-resolver-typescript
// installed and configured, every `.js`-extension NodeNext import resolves to an
// *unknown* element, and unknown targets are silently PERMITTED by default —
// so real violations pass lint with no error. If a deliberately-broken
// cross-module import ever passes `pnpm lint`, check this resolver first.
export default tseslint.config(
  { ignores: ['dist/**', 'drizzle/**', 'node_modules/**', 'src/api/openapi.json'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    // Tests are exempt from the boundary policy below (not the rest of this
    // config) — mocking legitimately crosses module lines, and a domain unit
    // test importing its own domain file would otherwise trip "domain: pure,
    // imports nothing local" against itself.
    ignores: ['**/*.test.ts'],
    settings: {
      'import/resolver': { typescript: true },
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/modules/(*)/domain/**', capture: ['module'] },
        { type: 'application', pattern: 'src/modules/(*)/application/**', capture: ['module'] },
        { type: 'infrastructure', pattern: 'src/modules/(*)/infrastructure/**', capture: ['module'] },
        { type: 'api', pattern: 'src/modules/(*)/api/**', capture: ['module'] },
        // Single-file elements need `mode: 'file'`. It is deprecated upstream,
        // but its suggested replacement (`partialMatch: false`) was spike-tested
        // and does NOT work (files stay isUnknown, policy never evaluated). The
        // "mode is deprecated" warning on lint is expected and intentional.
        { type: 'index', pattern: 'src/modules/(*)/index.ts', capture: ['module'], mode: 'file' },
        { type: 'outbox', pattern: 'src/modules/(*)/outbox.ts', capture: ['module'], mode: 'file' },
        { type: 'shared', pattern: 'src/shared/**' },
      ],
    },
    plugins: { boundaries },
    rules: {
      'boundaries/dependencies': [2, {
        default: 'disallow',
        policies: [
          // api (routes/schemas): only same-module domain/application/api, plus
          // shared and any module's public index. Never another module's guts.
          { from: { element: { type: 'api' } }, allow: [
            { element: { type: ['domain', 'application', 'api'], captured: { module: '{{from.captured.module}}' } } },
            { element: { type: ['shared', 'index'] } },
          ] },
          // application (use-cases): same-module domain/infrastructure/application,
          // shared, and any module's public index (the cross-module read surface).
          { from: { element: { type: 'application' } }, allow: [
            { element: { type: ['domain', 'infrastructure', 'application'], captured: { module: '{{from.captured.module}}' } } },
            { element: { type: ['shared', 'index'] } },
          ] },
          // infrastructure (repos/schemas): same-module domain/infrastructure + shared.
          // No cross-module reach at all, not even via index.
          { from: { element: { type: 'infrastructure' } }, allow: [
            { element: { type: ['domain', 'infrastructure'], captured: { module: '{{from.captured.module}}' } } },
            { element: { type: 'shared' } },
          ] },
          // domain: pure. Imports nothing local.
          { from: { element: { type: 'domain' } }, disallow: [{ element: { type: '*' } }] },
          // shared: may only reach a module through its narrow public files —
          // its index (public API) or its outbox (the one table the relay reads).
          { from: { element: { type: 'shared' } }, allow: [
            { element: { type: ['index', 'outbox', 'shared'] } },
          ] },
          // index (public surface): re-exports from same-module domain/application + shared.
          { from: { element: { type: 'index' } }, allow: [
            { element: { type: ['domain', 'application'], captured: { module: '{{from.captured.module}}' } } },
            { element: { type: 'shared' } },
          ] },
          // outbox (single-file re-export): pulls the table out of its own
          // module's infrastructure schema so shared/job-queue can import it.
          { from: { element: { type: 'outbox' } }, allow: [
            { element: { type: 'infrastructure', captured: { module: '{{from.captured.module}}' } } },
          ] },
        ],
      }],
    },
  },
)
