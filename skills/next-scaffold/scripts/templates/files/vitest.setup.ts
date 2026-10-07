import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without `globals`, so Testing Library cannot register its own cleanup:
// without this, components rendered by one test stay mounted for the next.
afterEach(cleanup)

// openapi-fetch builds `new Request('/api/v1/…')`. A browser resolves that against the page;
// Node's Request throws on a relative URL. Resolve it against jsdom's origin so client code
// under test sees what it would see in a browser.
const NativeRequest = globalThis.Request
globalThis.Request = class extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === 'string' && input.startsWith('/') ? new URL(input, window.location.origin) : input, init)
  }
} as typeof Request
