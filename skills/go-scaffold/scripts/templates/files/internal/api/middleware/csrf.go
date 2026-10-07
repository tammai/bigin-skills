package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/shared/config"
)

// CSRF refuses a state-changing request that a browser could have been tricked
// into sending: an unsafe method, carrying the session cookie, from an Origin
// not in the allowlist (resolved from WEB_ORIGINS and already normalised).
//
// SameSite=Lax is the first layer and stops most of this on its own. This is
// the second, because Lax still lets a same-site page — any subdomain — send
// the cookie, and because it is the only layer that works if a browser ignores
// SameSite. A missing Origin is refused rather than waved through: every
// browser sends one on a cross-origin POST/PUT/DELETE and on a same-origin one
// too, so its absence on a cookie request is a reason for suspicion, not
// leniency.
//
// What is checked:
//   - requests authenticated by cookie (Require marks them), and
//   - the public routes in csrfPublicRoutes (selector.go) — the session
//     endpoints, which create and destroy the credential itself.
//
// What is not: safe methods, which must not change state; Bearer requests,
// whose token a browser never attaches on its own; and every other public
// route, which carries no credential to forge.
//
// Runs AFTER the auth selector, so the cookie mark is already set.
func CSRF(webOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(webOrigins))
	for _, o := range webOrigins {
		allowed[o] = true
	}

	return func(c *gin.Context) {
		if safeMethod(c.Request.Method) || (!viaCookie(c) && !csrfPublicRoutes[c.FullPath()]) {
			c.Next()
			return
		}

		origin, ok := config.NormalizeOrigin(c.GetHeader("Origin"))
		if !ok || !allowed[origin] {
			abort(c, http.StatusForbidden, "Forbidden: request origin not allowed")
			return
		}
		c.Next()
	}
}

func safeMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	return false
}
