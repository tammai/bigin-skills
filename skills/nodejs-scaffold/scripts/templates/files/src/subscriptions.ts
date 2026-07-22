import { registerSubscriptions as registerPostsSubscriptions } from './modules/posts/index.js'

// Wires every module's event-bus subscriptions. Called by buildApp() (so tests
// that go through app.inject have live subscriptions) AND by src/server.ts
// before the job runner's first tick. Idempotent — the guard makes the double
// call a no-op.
let registered = false

export function registerAllSubscriptions(): void {
  if (registered) return
  registered = true
  registerPostsSubscriptions()
}
