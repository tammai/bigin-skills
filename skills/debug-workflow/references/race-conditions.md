# Race Conditions

Replace arbitrary waits with condition-based waiting — poll actual state, not a fixed delay.

**Don't:**
```ts
await new Promise(r => setTimeout(r, 2000))
expect(store.status).toBe('ready')
```

**Do (Vitest):**
```ts
await vi.waitFor(() => expect(store.status).toBe('ready'))
```

**Do (Playwright):**
```ts
await expect(locator).toHaveText('ready')
```

A fixed delay either flakes under load (too short) or wastes CI time (padded to be "safe"). Polling the actual condition is correct at any speed.

If the race is in production code, not just tests — e.g. a request firing before an auth token is ready — the fix is usually to await the actual dependency (a promise, a store's hydration flag), not to add a delay in the component.
