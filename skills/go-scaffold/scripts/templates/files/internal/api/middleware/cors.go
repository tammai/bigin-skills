package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORS echoes back the request's Origin only when it appears in the allowlist
// (resolved from CORS_ORIGINS at startup and passed in — this package reads no
// environment of its own). A literal "*" in the list allows every origin.
//
// Deliberately NOT a blanket "Access-Control-Allow-Origin: *": this API sends
// an Authorization header, and a wildcard origin combined with credentials is
// the classic misconfiguration that lets any site drive an authenticated
// browser session against it. Add the frontend's real origin to CORS_ORIGINS
// rather than widening this back to "*".
func CORS(allowed []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && originAllowed(allowed, origin) {
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

func originAllowed(allowed []string, origin string) bool {
	for _, a := range allowed {
		if a == "*" || strings.EqualFold(a, origin) {
			return true
		}
	}
	return false
}
