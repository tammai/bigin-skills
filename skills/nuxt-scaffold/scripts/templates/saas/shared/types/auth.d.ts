// The signed-in user, as the API returns it (go-scaffold's `User` schema: GET
// /api/v1/user/profile, and `user` in the POST /api/v1/auth/session response).
// The session itself is an HttpOnly cookie the browser can't read — this is only
// the profile the dashboard shows.
export type AuthUser = {
  id: number
  email: string
  full_name?: string
  role: string
}
