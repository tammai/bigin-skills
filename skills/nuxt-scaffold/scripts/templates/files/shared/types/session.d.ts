// The backend token pair shape, plus the nuxt-auth-utils augmentation that stores
// it under the server-only `secure` session key. This MUST live in shared/ (not
// server/): the `#auth-utils` module augmentation only merges when declared in the
// app/shared type graph — from a server/ .d.ts it silently fails to apply, while
// the server tsconfig still picks this up via its `../shared/**/*.d.ts` include.
//
// `SessionTokens` is defined here (shared-owned, isomorphic type) so both the
// server BFF (server/utils/backend.ts imports it) and this augmentation reference
// one definition. `expires_at` is an absolute epoch-ms deadline (see backend.ts).
export type SessionTokens = {
  access_token: string
  refresh_token: string
  expires_at: number
}

declare module '#auth-utils' {
  // Server-only: getUserSession(event) exposes `secure` server-side (the proxy +
  // auth routes); the client-side useUserSession() composable never receives it.
  interface SecureSessionData {
    tokens: SessionTokens
  }
}
