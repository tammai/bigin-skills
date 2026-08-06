package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORS echoes back the request's Origin only when it appears in the
// CORS_ORIGINS allowlist (comma-separated, from .env). A literal "*" in that
// list allows every origin.
//
// Deliberately NOT a blanket "Access-Control-Allow-Origin: *": this API sends
// an Authorization header, and a wildcard origin combined with credentials is
// the classic misconfiguration that lets any site drive an authenticated
// browser session against it. Add the frontend's real origin to CORS_ORIGINS
// instead of widening this back to "*".
func CORS() gin.HandlerFunc {
	allowed := parseOrigins(os.Getenv("CORS_ORIGINS"))

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && originAllowed(allowed, origin) {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Max-Age", "600")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func parseOrigins(raw string) []string {
	out := []string{}
	for _, o := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func originAllowed(allowed []string, origin string) bool {
	for _, a := range allowed {
		if a == "*" || strings.EqualFold(a, origin) {
			return true
		}
	}
	return false
}
