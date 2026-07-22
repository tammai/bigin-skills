package auth

// Static role→permission map (ADR §7). Deliberately NOT a DB table for a
// two-module scaffold — a documented extension point, not a gap. To move it to
// the DB, replace rolePermissions with a lookup and keep Can()'s signature.
//
// Can() is called INSIDE application/ use-cases, never in api/ handlers: the
// auth middleware only proves identity; authorization is a separate, explicit
// per-use-case check.
type Role = string
type Permission = string

const (
	RoleAdmin Role = "admin"
	RoleUser  Role = "user"

	PermUsersRead  Permission = "users:read"
	PermUsersErase Permission = "users:erase"
	PermPostsRead  Permission = "posts:read"
	PermPostsWrite Permission = "posts:write"
)

var rolePermissions = map[Role][]Permission{
	RoleAdmin: {PermUsersRead, PermUsersErase, PermPostsRead, PermPostsWrite},
	RoleUser:  {PermUsersRead, PermPostsRead, PermPostsWrite},
}

// Can reports whether any of the caller's roles grants the permission. Unknown
// roles are silently ignored.
func Can(roles []string, permission Permission) bool {
	for _, r := range roles {
		for _, p := range rolePermissions[r] {
			if p == permission {
				return true
			}
		}
	}
	return false
}
