package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/shared/config"
)

// CORS echoes back the request's Origin only when it appears in the allowlist
// (resolved from CORS_ORIGINS at startup and passed in — this package reads no
// environment of its own).
//
// Both sides are compared through config.NormalizeOrigin — the list once here,
// the request's Origin per request — which is the same comparison CSRF makes,
// so the two can never disagree about a trailing slash, letter case, or a
// default port. The header sent back is the request's Origin verbatim, because
// the browser checks it literally.
//
// There is no wildcard. config refuses "*" at boot, and a "*" entry here is
// just an unparseable origin that matches nothing: this API authenticates
// browsers with a cookie, and a wildcard origin combined with credentials is
// the classic misconfiguration that lets any site read a logged-in user's
// responses. Add the frontend's real origin to CORS_ORIGINS instead.
func CORS(allowed []string) gin.HandlerFunc {
	allow := make(map[string]bool, len(allowed))
	for _, a := range allowed {
		if o, ok := config.NormalizeOrigin(a); ok {
			allow[o] = true
		}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if normalised, ok := config.NormalizeOrigin(origin); ok && allow[normalised] {
			h := c.Writer.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Vary", "Origin")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Set("Access-Control-Max-Age", "600")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
