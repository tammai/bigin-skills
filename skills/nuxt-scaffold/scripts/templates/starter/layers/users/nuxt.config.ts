// The `users` feature layer. `imports.scan: false` is the ADR §5.1/5.3
// precondition for meaningful boundary lint: it disables auto-import scanning for
// THIS layer, so its composables/utils must be imported with an explicit `import`
// statement — which eslint-plugin-boundaries can then inspect and block when it
// crosses into another feature. (Nuxt's default auto-imports would make every
// cross-layer use implicit and invisible to the rule.) Pages/components are still
// registered as usual; only auto-import scanning is off.
export default defineNuxtConfig({
  imports: { scan: false }
})
