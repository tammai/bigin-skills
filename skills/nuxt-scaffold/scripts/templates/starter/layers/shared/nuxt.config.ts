// The `shared` layer: the reusable kernel every feature layer may import
// (api-client, shared components/composables). It imports no feature layer — the
// boundary lint (eslint.boundaries.mjs) enforces that direction.
export default defineNuxtConfig({})
