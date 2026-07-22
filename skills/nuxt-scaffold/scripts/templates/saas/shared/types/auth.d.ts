// Client-visible identity (exposed by useUserSession()). The backend token pair
// is NOT here — it lives under the server-only `secure` key (see
// shared/types/session.d.ts in the base preset).
declare module '#auth-utils' {
  interface User {
    id?: string
    email: string
    name?: string
  }
}

export {}
