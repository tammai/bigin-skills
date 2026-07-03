declare module '#auth-utils' {
  interface SecureSessionData {
    /** Backend access token — sealed-session secure data; nuxt-auth-utils never sends this to the client. */
    token: string
  }
}
