package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthByPath applies role-based auth based on the matched route's path prefix:
// /api/v1/user → user role, /api/v1/admin → admin role. Auth endpoints are public.
// Used because the generated router registers every operation on one router;
// this selector keeps per-prefix role enforcement.
//
// ⚠ These literals include the API version prefix because c.FullPath() returns the
// route as REGISTERED — i.e. GinServerOptions.BaseURL + the path from openapi.yaml.
// Change BaseURL in main.go and every prefix here must change with it, or the
// switch stops matching, every case falls through to `default: c.Next()`, and
// /user + /admin silently become PUBLIC. Nothing fails loudly, which is exactly why main_test.go asserts it.
func AuthByPath() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch {
		case strings.HasPrefix(c.FullPath(), "/api/v1/user"):
			AuthMiddleware("user")(c)
		case strings.HasPrefix(c.FullPath(), "/api/v1/admin"):
			AuthMiddleware("admin")(c)
		default:
			c.Next()
		}
	}
}

// RateLimitByPath applies per-route rate limits (each route keeps its own
// independent budget) to the public auth endpoints. All other routes pass
// through. Used because the generated router registers every operation on one
// router; this selector keeps the per-endpoint limits.
//
// ⚠ Same BaseURL coupling as AuthByPath above — an exact match here, so a stale
// prefix means signup/login lose their rate limit entirely (brute force reopens)
// while everything still returns 200 — main_test.go asserts against that too.
func RateLimitByPath() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.FullPath() {
		case "/api/v1/auth/signup":
			RateLimit("signup", 5, 5)(c)
		case "/api/v1/auth/login":
			RateLimit("login", 5, 5)(c)
		default:
			c.Next()
		}
	}
}
